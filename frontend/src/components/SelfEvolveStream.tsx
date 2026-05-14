/** Live timeline of self-evolve events — read → propose → apply → done.
 *  Renders each phase as a row, with the LLM's proposal and the on-disk
 *  diff as inline cards. */

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  FileCode2,
  Infinity as InfinityIcon,
  Loader2,
  Sparkles,
  Wand2,
} from "lucide-react";

import type { SelfEvolveStatus } from "@/hooks/useSelfEvolve";
import type {
  SelfEvolveAppliedChange,
  SelfEvolveChange,
  SelfEvolveEvent,
} from "@/types";

interface Props {
  events: SelfEvolveEvent[];
  status: SelfEvolveStatus;
  error: string | null;
  prompt: string | null;
}

export function SelfEvolveStream({ events, status, error, prompt }: Props) {
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
      </div>
    </motion.div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({
  status,
  prompt,
}: {
  status: SelfEvolveStatus;
  prompt: string | null;
}) {
  return (
    <div
      className="flex items-center gap-2 border-b pb-3"
      style={{ borderColor: "var(--color-border)" }}
    >
      <InfinityIcon
        className="h-4 w-4 shrink-0"
        style={{ color: "var(--color-primary)" }}
      />
      <span
        className="text-sm font-medium"
        style={{ color: "var(--color-text-primary)" }}
      >
        Self-evolving
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

function StatusDot({ status }: { status: SelfEvolveStatus }) {
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
      <span className="capitalize" style={{ color: "var(--color-text-muted)" }}>
        {status}
      </span>
    </span>
  );
}

// ─── Event router ─────────────────────────────────────────────────────────────

function EventBlock({ event }: { event: SelfEvolveEvent }) {
  switch (event.type) {
    case "step":
      return <StepRow event={event} />;
    case "proposal":
      return <ProposalCard summary={event.summary} changes={event.changes} />;
    case "applied":
      return <AppliedCard changes={event.changes} />;
    case "done":
      return null; // header status dot communicates this
    case "error":
      return <ErrorRow error={event.error} />;
    default:
      return null;
  }
}

// ─── Step row ─────────────────────────────────────────────────────────────────

function StepRow({
  event,
}: {
  event: Extract<SelfEvolveEvent, { type: "step" }>;
}) {
  const labels: Record<string, string> = {
    read_config: "Read config.toml",
    call_llm: "Asked the LLM",
    apply: "Applied to disk",
  };
  const label = labels[event.name] ?? event.name;
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-2 text-xs"
      style={{ color: "var(--color-text-secondary)" }}
    >
      <CheckCircle2
        className="h-3.5 w-3.5 shrink-0"
        style={{ color: "var(--color-success)" }}
      />
      <span>{label}</span>
    </motion.div>
  );
}

// ─── Proposal ────────────────────────────────────────────────────────────────

function ProposalCard({
  summary,
  changes,
}: {
  summary: string;
  changes: SelfEvolveChange[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border p-3"
      style={{
        background:
          "color-mix(in oklab, var(--color-surface) 70%, transparent)",
        borderColor: "var(--color-border)",
      }}
    >
      <div className="mb-2 flex items-center gap-2 text-xs">
        <Sparkles
          className="h-3.5 w-3.5"
          style={{ color: "var(--color-accent)" }}
        />
        <span
          className="font-medium"
          style={{ color: "var(--color-text-primary)" }}
        >
          Proposal
        </span>
        <span style={{ color: "var(--color-text-muted)" }}>· {summary}</span>
      </div>
      {changes.length === 0 ? (
        <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
          (no changes)
        </p>
      ) : (
        <ul className="space-y-1">
          {changes.map((c, i) => (
            <li
              key={i}
              className="flex items-baseline gap-2 font-mono text-[11px]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <code style={{ color: "var(--color-text-secondary)" }}>
                {c.path}
              </code>
              <span style={{ color: "var(--color-text-muted)" }}>=</span>
              <ValueChip value={c.value} />
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}

// ─── Applied (with before/after diff) ─────────────────────────────────────────

function AppliedCard({
  changes,
}: {
  changes: SelfEvolveAppliedChange[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border p-3"
      style={{
        background:
          "color-mix(in oklab, var(--color-success) 8%, transparent)",
        borderColor:
          "color-mix(in oklab, var(--color-success) 35%, var(--color-border))",
      }}
    >
      <div className="mb-2 flex items-center gap-2 text-xs">
        <Wand2 className="h-3.5 w-3.5" style={{ color: "var(--color-success)" }} />
        <span
          className="font-medium"
          style={{ color: "var(--color-text-primary)" }}
        >
          Applied
        </span>
        <span style={{ color: "var(--color-text-muted)" }}>
          · {changes.length} {changes.length === 1 ? "change" : "changes"}{" "}
          written to config.toml
        </span>
      </div>
      <ul className="space-y-1.5">
        {changes.map((c, i) => (
          <li
            key={i}
            className="flex flex-wrap items-baseline gap-2 font-mono text-[11px]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <FileCode2
              className="h-3 w-3 shrink-0 self-center"
              style={{ color: "var(--color-text-muted)" }}
            />
            <code style={{ color: "var(--color-text-secondary)" }}>{c.path}</code>
            <span style={{ color: "var(--color-text-muted)" }}>:</span>
            <ValueChip value={c.old_value} variant="old" />
            <span style={{ color: "var(--color-text-muted)" }}>→</span>
            <ValueChip value={c.new_value} variant="new" />
          </li>
        ))}
      </ul>
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
      <span>working…</span>
    </motion.div>
  );
}

function ErrorRow({ error }: { error: string }) {
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
      style={{
        background: "color-mix(in oklab, var(--color-error) 10%, transparent)",
        borderColor:
          "color-mix(in oklab, var(--color-error) 40%, var(--color-border))",
        color: "var(--color-error)",
      }}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{error}</span>
    </motion.div>
  );
}

// ─── Value rendering ──────────────────────────────────────────────────────────

function ValueChip({
  value,
  variant = "neutral",
}: {
  value: unknown;
  variant?: "old" | "new" | "neutral";
}) {
  const isColor =
    typeof value === "string" && /^#[0-9a-fA-F]{3,8}$/.test(value);

  const color =
    variant === "old"
      ? "var(--color-text-muted)"
      : variant === "new"
        ? "var(--color-text-primary)"
        : "var(--color-text-primary)";

  return (
    <span className="inline-flex items-center gap-1">
      {isColor && (
        <span
          aria-hidden
          className="inline-block h-3 w-3 rounded-sm ring-1"
          style={{
            background: value as string,
            // @ts-expect-error — TS doesn't know about --tw-ring-color
            "--tw-ring-color": "var(--color-border)",
          }}
        />
      )}
      <code
        className={variant === "old" ? "line-through opacity-60" : ""}
        style={{
          color,
          fontFamily: "var(--font-mono)",
        }}
      >
        {formatValue(value)}
      </code>
    </span>
  );
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return `"${value}"`;
  if (value === null || value === undefined) return "null";
  return JSON.stringify(value);
}
