"use client";

import * as React from "react";
import { Bot, ImagePlus, Send, User } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChatMessage, ChipOption, PendingPrompt } from "@/components/wizard/chat-types";

/** One answer button: the label an operator can act on, with the
 * recognisable example underneath. Stacked rather than tooltipped because
 * the example is the part that makes the option answerable, and nobody
 * hovers a chip on a shop floor. */
function ChipButton({
  option, active, disabled, onClick,
}: {
  option: ChipOption;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      size="sm" disabled={disabled} onClick={onClick}
      variant={active ? "default" : "outline"}
      className="h-auto max-w-full flex-col items-start gap-0.5 whitespace-normal py-1.5 text-left"
    >
      <span>{option.label}</span>
      {option.helpText && (
        <span className={`text-[11px] font-normal ${active ? "opacity-80" : "text-muted-foreground"}`}>
          {option.helpText}
        </span>
      )}
    </Button>
  );
}

/** Local pick-state, reset for free by remounting (parent keys this by
 * turn) rather than an effect that clears state on prop change. */
function ChipsMultiForm({
  options, maxPicks, confirmLabel, busy, preselected, onConfirm,
}: {
  options: ChipOption[];
  maxPicks?: number;
  confirmLabel: string;
  busy: boolean;
  preselected?: string[];
  onConfirm: (values: string[]) => void;
}) {
  const [picked, setPicked] = React.useState<string[]>(preselected ?? []);
  const exclusives = React.useMemo(
    () => new Set(options.filter((o) => o.exclusive).map((o) => o.value)),
    [options],
  );
  const atCap = maxPicks !== undefined && picked.length >= maxPicks;

  function toggle(option: ChipOption) {
    setPicked((prev) => {
      if (prev.includes(option.value)) return prev.filter((v) => v !== option.value);
      // An exclusive pick replaces everything; any real pick clears the
      // exclusives, so ["nothing unusual", "new lot"] can't be built.
      if (option.exclusive) return [option.value];
      return [...prev.filter((v) => !exclusives.has(v)), option.value];
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = picked.includes(o.value);
          // At the cap, unpicked options go quiet rather than silently
          // evicting an earlier pick — the first pick is the primary one.
          const capped = atCap && !active && !o.exclusive;
          return (
            <ChipButton
              key={o.value} option={o} active={active}
              disabled={busy || capped} onClick={() => toggle(o)}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={busy || picked.length === 0} onClick={() => onConfirm(picked)}>
          {confirmLabel}
        </Button>
        {maxPicks !== undefined && (
          <span className="text-xs text-muted-foreground">
            {atCap
              ? `${maxPicks} of ${maxPicks} picked — untick one to change it`
              : `pick up to ${maxPicks}, most important first`}
          </span>
        )}
      </div>
    </div>
  );
}

function TextForm({
  placeholder, confirmLabel, allowEmpty, busy, onSubmit,
}: {
  placeholder: string;
  confirmLabel: string;
  allowEmpty?: boolean;
  busy: boolean;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = React.useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim() || allowEmpty) onSubmit(value.trim());
      }}
    >
      <Input autoFocus placeholder={placeholder} value={value} disabled={busy} onChange={(e) => setValue(e.target.value)} />
      <Button type="submit" size="icon" disabled={busy || (!value.trim() && !allowEmpty)} aria-label={confirmLabel}>
        <Send className="size-4" />
      </Button>
    </form>
  );
}

export function ChatPanel({
  messages, pending, busy, onChipSingle, onChipsMulti, onText, onPhoto, onSkip,
}: {
  messages: ChatMessage[];
  pending: PendingPrompt;
  busy: boolean;
  onChipSingle: (value: string) => void;
  onChipsMulti: (values: string[]) => void;
  onText: (value: string) => void;
  onPhoto: (file: File) => void;
  onSkip: () => void;
}) {
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // Every new prompt follows at least one new message, so keying the input
  // area by the message count remounts it (and so resets any local pick/
  // text state) exactly when the prompt changes — no reset-on-prop effect.
  const turnKey = messages.length;

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-scroll thin-scrollbar px-4">
        <div className="flex flex-col gap-4 py-4">
          {messages.map((m) => (
            <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <Avatar className="size-7 shrink-0">
                <AvatarFallback>{m.role === "bot" ? <Bot className="size-4" /> : <User className="size-4" />}</AvatarFallback>
              </Avatar>
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "bot" ? "bg-muted" : "bg-primary text-primary-foreground"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex gap-2">
              <Avatar className="size-7 shrink-0"><AvatarFallback><Bot className="size-4" /></AvatarFallback></Avatar>
              <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">…</div>
            </div>
          )}
          <div ref={bottomRef} />
          {/* Extra bottom space allowing scrolling with conversation items on top */}
          <div className="h-[45vh] shrink-0 pointer-events-none" aria-hidden="true" />
        </div>
      </div>

      <div className="border-t p-3">
        {pending.kind === "chips-single" && (
          <div className="flex flex-wrap gap-2">
            {pending.options.map((o) => (
              <ChipButton key={o.value} option={o} disabled={busy} onClick={() => onChipSingle(o.value)} />
            ))}
          </div>
        )}

        {pending.kind === "chips-multi" && (
          <ChipsMultiForm
            key={turnKey} options={pending.options} maxPicks={pending.maxPicks}
            confirmLabel={pending.confirmLabel} busy={busy}
            preselected={pending.preselected} onConfirm={onChipsMulti}
          />
        )}

        {pending.kind === "confirm" && (
          <div className="flex flex-wrap gap-2">
            {pending.options.map((o) => (
              <Button key={o.value} size="sm" disabled={busy} onClick={() => onChipSingle(o.value)}>
                {o.label}
              </Button>
            ))}
          </div>
        )}

        {pending.kind === "text" && (
          <TextForm
            key={turnKey} placeholder={pending.placeholder} confirmLabel={pending.confirmLabel}
            allowEmpty={pending.allowEmpty} busy={busy} onSubmit={onText}
          />
        )}

        {pending.kind === "text-with-suggestions" && (
          <div className="space-y-2">
            {/* The skip sits outside the suggestions block on purpose: it
                used to be nested inside it, so a cause with no suggested
                check left the operator with a mandatory free-text field
                and no way out. */}
            <div className="flex flex-wrap items-center gap-2">
              {pending.suggestions.map((s) => (
                <ChipButton key={s.value} option={s} disabled={busy} onClick={() => onText(s.value)} />
              ))}
              <Button variant="ghost" size="sm" disabled={busy} onClick={onSkip}>
                {pending.skipLabel}
              </Button>
            </div>
            <TextForm
              key={turnKey} placeholder={pending.placeholder} confirmLabel={pending.confirmLabel}
              allowEmpty={false} busy={busy} onSubmit={onText}
            />
          </div>
        )}

        {pending.kind === "photo-or-skip" && (
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f); }}
            />
            <Button variant="outline" size="sm" disabled={busy} onClick={() => fileInputRef.current?.click()} className="gap-1.5">
              <ImagePlus className="size-4" /> Attach photo
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={onSkip}>
              {pending.skipLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
