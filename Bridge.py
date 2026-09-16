import os

# Example using Google GenAI / OpenAI SDK (Person 2 will supply their exact client)
# from google import genai
# client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

def run_rag_diagnosis(symptom: str, material: str, q_freq: str, q_changes: str, retrieved_rag_data: dict) -> dict:
    """
    Called by Person 3 (UI). Links retrieved factory memory to the LLM prompt.
    """

    # 1. Format the retrieved cases from Person 3's ChromaDB & SQLite
    cases_context = "\n".join([f"- Past Case: {doc}" for doc in retrieved_rag_data.get("matched_docs", [])])

    stats_context = "\n".join([
        f"- Cause: {item['cause']} (Found in {item['count']} past tickets, Historical Odds: {item['likelihood_pct']}%)"
        for item in retrieved_rag_data.get("ranked_causes", [])
    ])

    # 2. Construct the Augmented Prompt (The core RAG link)
    augmented_prompt = f"""
You are an expert diagnostic assistant for NSW Automation industrial dispensing machines.

[CURRENT DEFECT OBSERVATION]
- Material: {material}
- Operator Symptom: {symptom}
- Defect Pattern: {q_freq}
- Recent Machine Changes: {q_changes}

[RETRIEVED FACTORY MEMORY (RAG CONTEXT)]
The vector database retrieved the following most similar past incidents:
{cases_context}

Historical Cause Frequency for these matches:
{stats_context}

[TASK]
Using the factory memory above as primary evidence:
1. Provide a direct 2-sentence diagnostic assessment explaining the primary cause.
2. Formulate a 3-step Standard Operating Procedure (SOP) to resolve it immediately.
"""

    # 3. Call the LLM (Mocked fallback until Person 2 configures live credentials)
    try:
        # Example live call:
        # response = client.models.generate_content(
        #     model="gemini-2.5-flash",
        #     contents=augmented_prompt
        # )
        # return {"assessment": response.text, "status": "live"}

        # MOCK RESPONSE (Active until P2 plugs in their API key):
        top_cause = retrieved_rag_data["ranked_causes"][0]["cause"] if retrieved_rag_data["ranked_causes"] else "Unknown"
        return {
            "assessment": (
                f"Based on historical ticket precedent and the reported {q_freq.lower()} pattern, "
                f"the root cause is determined to be **{top_cause}**. "
                f"Past factory records indicate this matches previous {material} dispensing failures."
            ),
            "sop_steps": [
                f"Isolate dispensing valve and inspect for {top_cause.lower()} indicators.",
                "Purge fluid lines at specified operating pressure.",
                "Perform test dot array calibration before resuming full production."
            ]
        }
    except Exception as e:
        return {
            "assessment": f"LLM Diagnostic Error: {str(e)}",
            "sop_steps": ["Check manual troubleshooting handbook."]
        }