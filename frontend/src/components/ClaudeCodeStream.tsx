/** Live timeline of Claude Code events: assistant text + tool calls + result.
 *  Skips noisy ``system`` and bare ``user`` echoes; surfaces ``error`` events. */

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Wrench,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import "highlight.js/styles/github-dark.css";

import type { ClaudeCodeStatus } from "@/hooks/useClaudeCode";
import type { ClaudeCodeContentBlock, ClaudeCodeEvent } from "@/types";

interface Props {
  events: ClaudeCodeEvent[];
  status: ClaudeCodeStatus;
  error: string | null;
  prompt: string | null;
}

export function ClaudeCodeStream({ events, status, error, prompt }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="w-full space-y-3 rounded-2xl border p-5 backdrop-blur-xl"
      style={{
        background:
          "color-mix(in oklab, var(--color-surface-elevated) 70%, transparent)",
        borderColor: "var(--color-border)",
      }}
    >
      <Header status={status} prompt={prompt} />

      <div className="space-y-2.5">
        <AnimatePresence initial={false}>
          {events.map((event, i) => (
            <EventBlock key={i} event={event} />
          ))}
        </AnimatePresence>

        {status === "running" && <ThinkingRow />}
        {status === "error" && error && <ErrorRow error={error} />}
        {status === "done" && events.length === 0 && (
          <p
            className="text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            (no output)
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({
  status,
  prompt,
}: {
  status: ClaudeCodeStatus;
  prompt: string | null;
}) {
  return (
    <div
      className="flex items-center gap-2 border-b pb-3"
      style={{ borderColor: "var(--color-border)" }}
    >
      <Sparkles
        className="h-4 w-4 shrink-0"
        style={{ color: "var(--color-primary)" }}
      />
      <span
        className="text-sm font-medium"
        style={{ color: "var(--color-text-primary)" }}
      >
        Claude Code
      </span>
      {prompt && (
        <span
          className="truncate text-xs opacity-60"
          style={{ color: "var(--color-text-secondary)" }}
          title={prompt}
        >
          · {prompt}
        </span>
      )}
      <span className="flex-1" />
      <StatusDot status={status} />
    </div>
  );
}

function StatusDot({ status }: { status: ClaudeCodeStatus }) {
  const color =
    status === "running"
      ? "var(--color-primary)"
      : status === "error"
        ? "var(--color-error)"
        : status === "done"
          ? "var(--color-success)"
          : "var(--color-text-muted)";

  return (
    <span className="flex items-center gap-1.5 text-[11px]">
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      <span
        className="capitalize"
        style={{ color: "var(--color-text-muted)" }}
      >
        {status}
      </span>
    </span>
  );
}

// ─── Event router ─────────────────────────────────────────────────────────────

function EventBlock({ event }: { event: ClaudeCodeEvent }) {
  switch (event.type) {
    case "assistant":
      return <AssistantBlocks content={event.message.content} />;
    case "user":
      return <ToolResultRow content={event.message.content} />;
    case "error":
      return <ErrorRow error={event.error} />;
    case "result":
    case "system":
    default:
      return null;
  }
}

// ─── Assistant content (text + tool_use) ──────────────────────────────────────

function AssistantBlocks({ content }: { content: ClaudeCodeContentBlock[] }) {
  return (
    <div className="space-y-2">
      {content.map((block, i) => {
        if (block.type === "text" && block.text.trim()) {
          return <TextBlock key={i} text={block.text} />;
        }
        if (block.type === "tool_use") {
          return <ToolUseRow key={i} name={block.name} input={block.input} />;
        }
        return null;
      })}
    </div>
  );
}

function TextBlock({ text }: { text: string }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="prose prose-sm sm:prose-base max-w-none"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      >
        {text}
      </ReactMarkdown>
    </motion.article>
  );
}

function ToolUseRow({
  name,
  input,
}: {
  name: string;
  input: Record<string, unknown>;
}) {
  const summary = summarizeToolInput(name, input);
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs"
      style={{
        background:
          "color-mix(in oklab, var(--color-surface) 70%, transparent)",
        borderColor: "var(--color-border)",
      }}
    >
      <Wrench
        className="h-3 w-3 shrink-0"
        style={{ color: "var(--color-accent)" }}
      />
      <span
        className="font-medium"
        style={{ color: "var(--color-text-primary)" }}
      >
        {name}
      </span>
      {summary && (
        <code
          className="min-w-0 truncate text-[11px] opacity-70"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-text-secondary)",
          }}
          title={summary}
        >
          {summary}
        </code>
      )}
    </motion.div>
  );
}

// ─── Tool result echo (compact pass/fail indicator) ───────────────────────────

function ToolResultRow({ content }: { content: ClaudeCodeContentBlock[] }) {
  const results = content.filter(
    (b): b is Extract<ClaudeCodeContentBlock, { type: "tool_result" }> =>
      b.type === "tool_result",
  );
  if (results.length === 0) return null;

  const hasError = results.some((r) => r.is_error);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: hasError ? 0.9 : 0.6 }}
      className="ml-5 flex items-center gap-1.5 text-[11px]"
      style={{
        color: hasError ? "var(--color-error)" : "var(--color-success)",
      }}
    >
      {hasError ? (
        <AlertTriangle className="h-3 w-3" />
      ) : (
        <CheckCircle2 className="h-3 w-3" />
      )}
      <span>{hasError ? "tool failed" : "tool ok"}</span>
    </motion.div>
  );
}

// ─── Status rows ──────────────────────────────────────────────────────────────

function ThinkingRow() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-2 text-xs"
      style={{ color: "var(--color-text-muted)" }}
    >
      <Loader2
        className="h-3 w-3 animate-spin"
        style={{ color: "var(--color-primary)" }}
      />
      <span>thinking…</span>
    </motion.div>
  );
}

function ErrorRow({ error }: { error: string }) {
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border px-3 py-2 text-sm"
      style={{
        background: "color-mix(in oklab, var(--color-error) 10%, transparent)",
        borderColor:
          "color-mix(in oklab, var(--color-error) 40%, var(--color-border))",
        color: "var(--color-error)",
      }}
    >
      {error}
    </motion.div>
  );
}

// ─── Tool input → one-line summary ────────────────────────────────────────────

function summarizeToolInput(
  name: string,
  input: Record<string, unknown>,
): string {
  const str = (k: string): string =>
    typeof input[k] === "string" ? (input[k] as string) : "";

  switch (name) {
    case "Read":
    case "Edit":
    case "Write":
    case "NotebookEdit":
      return str("file_path");
    case "Bash":
      return str("command");
    case "Glob":
    case "Grep":
      return str("pattern");
    case "WebFetch":
    case "WebSearch":
      return str("url") || str("query");
    default: {
      const json = JSON.stringify(input);
      return json.length > 80 ? `${json.slice(0, 80)}…` : json;
    }
  }
}
