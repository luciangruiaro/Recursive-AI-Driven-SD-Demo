import { describe, expect, it } from "vitest";

import { parseInput } from "@/App";

describe("parseInput", () => {
  it("treats normal input as a chat message", () => {
    expect(parseInput("hello there")).toEqual({
      mode: "chat",
      payload: "hello there",
    });
  });

  it("trims whitespace around chat input", () => {
    expect(parseInput("  hi  ")).toEqual({ mode: "chat", payload: "hi" });
  });

  it("routes /code <payload> to claude-code mode and strips the prefix", () => {
    expect(parseInput("/code refactor the auth module")).toEqual({
      mode: "code",
      payload: "refactor the auth module",
    });
  });

  it("handles leading whitespace before /code", () => {
    expect(parseInput("   /code list files")).toEqual({
      mode: "code",
      payload: "list files",
    });
  });

  it("treats bare /code as code mode with empty payload", () => {
    expect(parseInput("/code")).toEqual({ mode: "code", payload: "" });
    expect(parseInput("  /code  ")).toEqual({ mode: "code", payload: "" });
  });

  it("does NOT match /codex or /coder — only /code followed by space or end", () => {
    expect(parseInput("/codex hi")).toEqual({
      mode: "chat",
      payload: "/codex hi",
    });
    expect(parseInput("/coder")).toEqual({
      mode: "chat",
      payload: "/coder",
    });
  });

  it("preserves multi-line payload after /code", () => {
    const input = "/code please do:\n- step one\n- step two";
    expect(parseInput(input)).toEqual({
      mode: "code",
      payload: "please do:\n- step one\n- step two",
    });
  });

  it("routes /self <payload> to self-evolve mode and strips the prefix", () => {
    expect(parseInput("/self make the background red")).toEqual({
      mode: "self",
      payload: "make the background red",
    });
  });

  it("treats bare /self as self mode with empty payload", () => {
    expect(parseInput("/self")).toEqual({ mode: "self", payload: "" });
    expect(parseInput("  /self  ")).toEqual({ mode: "self", payload: "" });
  });

  it("handles leading whitespace before /self", () => {
    expect(parseInput("   /self bump max_tokens to 2048")).toEqual({
      mode: "self",
      payload: "bump max_tokens to 2048",
    });
  });

  it("does NOT match /selfish or /selfevolve — only /self followed by space or end", () => {
    expect(parseInput("/selfish prompt")).toEqual({
      mode: "chat",
      payload: "/selfish prompt",
    });
    expect(parseInput("/selfevolve")).toEqual({
      mode: "chat",
      payload: "/selfevolve",
    });
  });
});
