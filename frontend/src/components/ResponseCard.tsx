/** Renders the LLM response as Markdown inside a frosted glass card.
 *  Also surfaces error states from the chat controller. */

import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import "highlight.js/styles/github-dark.css";

import type { ChatStatus } from "@/hooks/useChat";

interface ResponseCardProps {
  status: ChatStatus;
  content: string | null;
  model: string | null;
  error: string | null;
}

export function ResponseCard({ status, content, model, error }: ResponseCardProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {status === "loading" && (
        <motion.div
          key="loading"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="flex w-full items-center gap-3 rounded-2xl border px-5 py-4 backdrop-blur-xl"
          style={{
            background:
              "color-mix(in oklab, var(--color-surface) 60%, transparent)",
            borderColor: "var(--color-border)",
            color: "var(--color-text-secondary)",
          }}
        >
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="block h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--color-primary)" }}
                animate={{ opacity: [0.2, 1, 0.2], y: [0, -2, 0] }}
                transition={{
                  duration: 1.1,
                  delay: i * 0.15,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}
          </span>
          <span className="text-sm">Thinking…</span>
        </motion.div>
      )}

      {status === "success" && content && (
        <motion.div
          key="success"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full rounded-2xl border p-6 backdrop-blur-xl"
          style={{
            background:
              "color-mix(in oklab, var(--color-surface-elevated) 70%, transparent)",
            borderColor: "var(--color-border)",
          }}
        >
          <article className="prose prose-sm sm:prose-base max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {content}
            </ReactMarkdown>
          </article>
          {model && (
            <div
              className="mt-5 flex items-center gap-2 border-t pt-3 text-xs tracking-wide"
              style={{
                borderColor: "var(--color-border)",
                color: "var(--color-text-muted)",
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--color-success)" }}
              />
              <span>via {model}</span>
            </div>
          )}
        </motion.div>
      )}

      {status === "error" && error && (
        <motion.div
          key="error"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
          role="alert"
          className="w-full rounded-2xl border p-4 text-sm backdrop-blur"
          style={{
            background:
              "color-mix(in oklab, var(--color-error) 10%, transparent)",
            borderColor:
              "color-mix(in oklab, var(--color-error) 40%, var(--color-border))",
            color: "var(--color-error)",
          }}
        >
          {error}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
