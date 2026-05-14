import { motion } from "framer-motion";

import { Background } from "@/components/Background";
import { ChatInput } from "@/components/ChatInput";
import { ClaudeCodeStream } from "@/components/ClaudeCodeStream";
import { ResponseCard } from "@/components/ResponseCard";
import { useChat } from "@/hooks/useChat";
import { useClaudeCode } from "@/hooks/useClaudeCode";
import { useConfig } from "@/hooks/useConfig";
import { ThemeProvider } from "@/theme/ThemeProvider";

const CODE_PREFIX = "/code";

interface ParsedInput {
  mode: "chat" | "code";
  payload: string;
}

export function parseInput(raw: string): ParsedInput {
  const trimmed = raw.trim();
  if (trimmed === CODE_PREFIX || trimmed.startsWith(`${CODE_PREFIX} `)) {
    return { mode: "code", payload: trimmed.slice(CODE_PREFIX.length).trim() };
  }
  return { mode: "chat", payload: trimmed };
}

export default function App() {
  const { config, error: configError, loading: configLoading } = useConfig();
  const chat = useChat();
  const cc = useClaudeCode();

  if (configLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <motion.div
          className="h-7 w-7 rounded-full border-2"
          style={{ borderColor: "var(--color-border)", borderTopColor: "var(--color-primary)" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  if (configError || !config) {
    return (
      <div className="grid min-h-screen place-items-center p-8">
        <div className="max-w-md text-center">
          <h1
            className="mb-2 text-lg font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Backend unreachable
          </h1>
          <p
            className="text-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {configError ?? "No config returned."}
          </p>
          <p
            className="mt-3 text-xs opacity-60"
            style={{ color: "var(--color-text-muted)" }}
          >
            Make sure the backend is running:{" "}
            <code
              className="rounded px-1.5 py-0.5"
              style={{ background: "var(--color-surface)" }}
            >
              uv run python -m app
            </code>
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = (raw: string) => {
    const { mode, payload } = parseInput(raw);
    if (mode === "code") {
      if (!payload) return; // bare "/code" — nothing to do
      chat.reset();
      void cc.send(payload);
      return;
    }
    cc.reset();
    void chat.send(payload);
  };

  const codeActive = cc.status !== "idle";
  const chatActive =
    chat.status === "loading" ||
    chat.status === "success" ||
    chat.status === "error";
  const isLoading = chat.status === "loading" || cc.status === "running";

  return (
    <ThemeProvider theme={config.theme}>
      <Background />

      <main className="relative mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-8 px-6 py-16">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <h1
            className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{
              color: "var(--color-text-primary)",
              backgroundImage:
                "linear-gradient(120deg, var(--color-text-primary) 0%, color-mix(in oklab, var(--color-primary) 60%, var(--color-text-primary)) 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {config.title}
          </h1>
          <p
            className="mt-3 text-balance text-sm sm:text-base"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {config.subtitle}
          </p>
        </motion.header>

        <div className="w-full">
          <ChatInput
            placeholder={config.placeholder}
            loading={isLoading}
            onSubmit={handleSubmit}
          />
        </div>

        {codeActive && (
          <div className="w-full">
            <ClaudeCodeStream
              events={cc.events}
              status={cc.status}
              error={cc.error}
              prompt={cc.prompt}
            />
          </div>
        )}

        {!codeActive && chatActive && (
          <div className="w-full">
            <ResponseCard
              status={chat.status}
              content={chat.response}
              model={chat.model}
              error={chat.error}
            />
          </div>
        )}
      </main>
    </ThemeProvider>
  );
}
