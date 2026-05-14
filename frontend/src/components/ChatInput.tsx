/** Chat-style input: auto-growing textarea + send button.
 *  Enter submits, Shift+Enter inserts a newline. */

import { motion } from "framer-motion";
import { ArrowUp, Loader2 } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

interface ChatInputProps {
  placeholder: string;
  loading: boolean;
  onSubmit: (message: string) => void;
}

const MAX_HEIGHT_PX = 240;

export function ChatInput({ placeholder, loading, onSubmit }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-size the textarea up to MAX_HEIGHT_PX.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value]);

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !loading;

  const submit = () => {
    if (!canSend) return;
    onSubmit(trimmed);
    setValue("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  return (
    <motion.form
      onSubmit={onFormSubmit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full"
    >
      {/* Soft focus glow */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: focused ? 0.5 : 0 }}
        transition={{ duration: 0.3 }}
        className="pointer-events-none absolute -inset-px rounded-2xl blur-md"
        style={{
          background:
            "linear-gradient(120deg, var(--color-primary), var(--color-accent))",
        }}
      />

      <div
        className="relative flex items-end gap-2 rounded-2xl border p-2.5 backdrop-blur-xl transition-colors"
        style={{
          background:
            "color-mix(in oklab, var(--color-surface) 75%, transparent)",
          borderColor: focused
            ? "color-mix(in oklab, var(--color-primary) 60%, var(--color-border))"
            : "var(--color-border)",
          boxShadow:
            "0 8px 32px -8px rgb(0 0 0 / 0.5), inset 0 1px 0 0 rgb(255 255 255 / 0.04)",
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={1}
          placeholder={placeholder}
          disabled={loading}
          autoFocus
          className="min-h-[28px] flex-1 resize-none bg-transparent px-2.5 py-2 text-base leading-relaxed outline-none placeholder:opacity-40 disabled:opacity-50"
          style={{
            color: "var(--color-text-primary)",
            fontFamily: "var(--font-sans)",
            maxHeight: `${MAX_HEIGHT_PX}px`,
          }}
        />

        <motion.button
          type="submit"
          disabled={!canSend}
          whileTap={canSend ? { scale: 0.92 } : undefined}
          whileHover={canSend ? { scale: 1.05 } : undefined}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          aria-label="Send message"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-30"
          style={{
            background: canSend
              ? "var(--color-primary)"
              : "color-mix(in oklab, var(--color-primary) 40%, var(--color-surface))",
            color: "white",
            boxShadow: canSend
              ? "0 4px 14px -2px color-mix(in oklab, var(--color-primary) 60%, transparent)"
              : "none",
          }}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          )}
        </motion.button>
      </div>

      <div
        className="mt-2 flex items-center justify-between gap-3 px-1 text-[11px] tracking-wide"
        style={{ color: "var(--color-text-muted)" }}
      >
        <CommandHint value={value} />

        <div className="flex gap-3 opacity-50">
          <span>
            <kbd className="rounded border px-1 py-0.5 text-[10px]" style={{ borderColor: "var(--color-border)" }}>
              ↵
            </kbd>{" "}
            send
          </span>
          <span>
            <kbd className="rounded border px-1 py-0.5 text-[10px]" style={{ borderColor: "var(--color-border)" }}>
              ⇧
            </kbd>
            +
            <kbd className="rounded border px-1 py-0.5 text-[10px]" style={{ borderColor: "var(--color-border)" }}>
              ↵
            </kbd>{" "}
            newline
          </span>
        </div>
      </div>
    </motion.form>
  );
}

function CommandHint({ value }: { value: string }) {
  const trimmed = value.trim();
  const isCode = trimmed === "/code" || trimmed.startsWith("/code ");
  if (!isCode) return <span />;

  return (
    <motion.span
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium"
      style={{
        borderColor:
          "color-mix(in oklab, var(--color-primary) 50%, var(--color-border))",
        background:
          "color-mix(in oklab, var(--color-primary) 12%, transparent)",
        color: "var(--color-primary)",
      }}
    >
      <span
        className="inline-block h-1 w-1 rounded-full"
        style={{ background: "var(--color-primary)" }}
      />
      Claude Code
    </motion.span>
  );
}
