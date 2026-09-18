"""Model backends for the VLM benchmark -- one process, one model.

The real GPU here is a 4GB card (checked with nvidia-smi; smaller than the
6GB originally assumed), so this deliberately never loads two models into
the same process: runner.py only imports the single backend named by
--model, each backend lazily imports its own heavy deps on first call, and
the process exiting after one model's run is what actually frees its VRAM
for the next. Don't add a "run all models" mode that keeps them all loaded
-- invoke runner.py once per model instead.

infer(image_path, prompt) -> str is the common shape: the model's raw text
response, left unparsed (see parse.py) so every backend can be exercised
identically regardless of how well it followed the JSON instruction.
"""

from __future__ import annotations

import pathlib
import time

_STATE: dict[str, dict] = {}


def _state(name: str) -> dict:
    return _STATE.setdefault(name, {})


def moondream2(image_path: pathlib.Path, prompt: str) -> str:
    """~1.8B params. Runs on CPU, deliberately -- two GPU attempts failed
    first:
    fp16 (~3.5GB weights) OOM'd on the very first forward pass, since
    nvidia-smi's 4096MiB is this card's nominal total, not what's actually
    free (observed 3.68GiB free in practice, no headroom left over for
    activations). Loading 8-bit via bitsandbytes to shrink the weights then
    hit `RuntimeError: expected scalar type Float but found Half` inside
    moondream2's own trust_remote_code modeling code, which hardcodes a
    bfloat16 cast ahead of the quantized matmul regardless of the dtype
    this call requests -- not something fixable from the caller's side
    without patching the remote code itself. CPU sidesteps both: no VRAM
    budget to exceed, and no quantization path to conflict with. Slower per
    image, but this is offline benchmarking, not a latency-sensitive path.
    """
    st = _state("moondream2")
    if "model" not in st:
        from transformers import AutoModelForCausalLM

        st["model"] = AutoModelForCausalLM.from_pretrained(
            "vikhyatk/moondream2",
            revision="2025-06-21",
            trust_remote_code=True,
            device_map={"": "cpu"},
        )

    from PIL import Image

    image = Image.open(image_path).convert("RGB")
    return st["model"].query(image, prompt)["answer"]


def qwen2_5_vl_3b(image_path: pathlib.Path, prompt: str) -> str:
    """3B params. Runs on CPU, deliberately -- two GPU attempts failed
    first: 4-bit (bitsandbytes) generated a real but garbage 4-token
    response ("{\\n failed to<|im_end|>") specifically on this benchmark's
    long prompt (862 tokens + image = 1325 total) -- confirmed by testing
    the identical prompt unquantized on CPU, which produced a normal,
    correctly-formatted JSON answer, isolating 4-bit numerical instability
    under long context as the cause (a short test prompt worked fine even
    at 4-bit, so it's specifically prompt length, not the model or the
    quantization scheme in general). 8-bit was tried next and refused to
    load at all: this GPU's ~3.68GB actually-free VRAM (see moondream2's
    note above) isn't enough to hold it without CPU/disk offload. CPU
    avoids both failure modes -- slower, but this is offline benchmarking.
    """
    st = _state("qwen2_5_vl_3b")
    if "model" not in st:
        import torch
        from transformers import AutoProcessor, Qwen2_5_VLForConditionalGeneration

        model_id = "Qwen/Qwen2.5-VL-3B-Instruct"
        st["model"] = Qwen2_5_VLForConditionalGeneration.from_pretrained(
            model_id, dtype=torch.float32, device_map="cpu"
        )
        st["processor"] = AutoProcessor.from_pretrained(model_id)

    from qwen_vl_utils import process_vision_info

    messages = [{
        "role": "user",
        "content": [{"type": "image", "image": str(image_path)}, {"type": "text", "text": prompt}],
    }]
    processor = st["processor"]
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    image_inputs, video_inputs = process_vision_info(messages)
    inputs = processor(
        text=[text], images=image_inputs, videos=video_inputs, padding=True, return_tensors="pt",
    ).to(st["model"].device)

    generated = st["model"].generate(**inputs, max_new_tokens=256, do_sample=False)
    trimmed = [out[len(inp):] for inp, out in zip(inputs.input_ids, generated)]
    return processor.batch_decode(trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False)[0]


def smolvlm2(image_path: pathlib.Path, prompt: str) -> str:
    """2.2B params. Runs on CPU, deliberately -- not tested on GPU at all,
    on the strength of what the other two backends above already found on
    this same ~3.68GB-usable card: a 4-bit quantized load degraded badly
    under this benchmark's long (862-token) shared prompt (qwen2_5_vl_3b),
    and 8-bit didn't fit without CPU/disk offload (moondream2, qwen both).
    Going straight to CPU here rather than re-running that same discovery
    a third time -- correctness over speed, this is offline benchmarking.

    generate() returns the input prompt tokens followed by the new ones;
    an early version of this function decoded that whole sequence instead
    of slicing off the prompt, so parse.py's keyword fallback matched every
    tag name because they're all in the *prompt* text, not any answer --
    the model was never actually wrong, this function was.
    """
    st = _state("smolvlm2")
    if "model" not in st:
        import torch
        from transformers import AutoModelForImageTextToText, AutoProcessor

        model_id = "HuggingFaceTB/SmolVLM2-2.2B-Instruct"
        st["processor"] = AutoProcessor.from_pretrained(model_id)
        st["model"] = AutoModelForImageTextToText.from_pretrained(
            model_id, dtype=torch.float32, device_map="cpu"
        )

    from PIL import Image

    image = Image.open(image_path).convert("RGB")
    processor = st["processor"]
    messages = [{
        "role": "user",
        "content": [{"type": "image", "url": image}, {"type": "text", "text": prompt}],
    }]
    inputs = processor.apply_chat_template(
        messages, add_generation_prompt=True, tokenize=True, return_dict=True, return_tensors="pt",
    ).to(st["model"].device)

    generated = st["model"].generate(**inputs, do_sample=False, max_new_tokens=256)
    trimmed = generated[:, inputs["input_ids"].shape[1]:]
    return processor.batch_decode(trimmed, skip_special_tokens=True)[0]


# Confirmed live 2026-09-15 on this project's key: the free tier for the
# configured GEMINI_MODEL allows only 20 requests/day and 5/minute.
# PAUSED (see docs/vlm_benchmark_log.md) until there's a plan for that quota
# -- runner.py's gemini backend is not currently invoked in normal runs.
# GEMINI_DAILY_LIMIT guards against accidentally burning the whole day's
# quota in one run (e.g. forgetting --limit); it only counts calls made by
# this process, not previous runs today, so it's a backstop, not a tracker.
GEMINI_DAILY_LIMIT = 20
GEMINI_MIN_SECONDS_BETWEEN_CALLS = 13.0  # keeps well under the 5/minute cap


def gemini(image_path: pathlib.Path, prompt: str) -> str:
    """Called over the network via the Gemini API -- no local VRAM use.
    Reads GEMINI_API_KEY / GEMINI_MODEL from vlm_bench/.env."""
    st = _state("gemini")
    if "client" not in st:
        import os

        from dotenv import load_dotenv
        from google import genai

        load_dotenv(pathlib.Path(__file__).resolve().parent / ".env")
        st["model_id"] = os.environ["GEMINI_MODEL"]
        st["client"] = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
        st["call_count"] = 0
        st["last_call_ts"] = 0.0

    if st["call_count"] >= GEMINI_DAILY_LIMIT:
        raise RuntimeError(
            f"Refusing to exceed the {GEMINI_DAILY_LIMIT}-call free-tier daily budget "
            f"in a single run. Pass a smaller --limit, or raise GEMINI_DAILY_LIMIT if "
            f"you've confirmed a higher quota."
        )
    wait = GEMINI_MIN_SECONDS_BETWEEN_CALLS - (time.time() - st["last_call_ts"])
    if wait > 0:
        time.sleep(wait)

    from google.genai import errors, types

    mime_type = "image/png" if image_path.suffix.lower() == ".png" else "image/jpeg"
    part = types.Part.from_bytes(data=image_path.read_bytes(), mime_type=mime_type)

    # A first live smoke test hit 503 UNAVAILABLE ("high demand") on a
    # preview model -- transient server-side overload, not a bad key/model
    # id. Retried once with a longer wait rather than surfacing immediately,
    # but kept to only 2 attempts total (not the usual 5) given how little
    # of the daily quota there is to spend retrying the same sample.
    delay = 10.0
    for attempt in range(2):
        st["call_count"] += 1
        st["last_call_ts"] = time.time()
        try:
            response = st["client"].models.generate_content(
                model=st["model_id"], contents=[prompt, part],
            )
            return response.text
        except errors.ServerError:
            if attempt == 1:
                raise
            time.sleep(delay)


BACKENDS = {
    "moondream2": moondream2,
    "qwen2.5-vl-3b": qwen2_5_vl_3b,
    "smolvlm2": smolvlm2,
    "gemini": gemini,
}
