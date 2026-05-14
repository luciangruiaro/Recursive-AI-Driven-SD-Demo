import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChatInput } from "@/components/ChatInput";

describe("<ChatInput />", () => {
  it("renders the placeholder and a disabled send button when empty", () => {
    render(<ChatInput placeholder="Ask anything" loading={false} onSubmit={vi.fn()} />);

    expect(screen.getByPlaceholderText("Ask anything")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });

  it("enables the send button once the user types non-whitespace", async () => {
    const user = userEvent.setup();
    render(<ChatInput placeholder="…" loading={false} onSubmit={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("…"), "Hello");

    expect(screen.getByRole("button", { name: /send/i })).toBeEnabled();
  });

  it("calls onSubmit with the trimmed message when Enter is pressed", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ChatInput placeholder="…" loading={false} onSubmit={onSubmit} />);

    const textarea = screen.getByPlaceholderText("…");
    await user.type(textarea, "   Hello there   ");
    await user.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("Hello there");
  });

  it("Shift+Enter inserts a newline and does not submit", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ChatInput placeholder="…" loading={false} onSubmit={onSubmit} />);

    const textarea = screen.getByPlaceholderText("…") as HTMLTextAreaElement;
    await user.type(textarea, "Line 1{Shift>}{Enter}{/Shift}Line 2");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(textarea.value).toBe("Line 1\nLine 2");
  });

  it("does not submit empty / whitespace-only input", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ChatInput placeholder="…" loading={false} onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText("…"), "   ");
    await user.keyboard("{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables input and shows the spinner while loading", () => {
    render(<ChatInput placeholder="…" loading={true} onSubmit={vi.fn()} />);

    expect(screen.getByPlaceholderText("…")).toBeDisabled();
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });
});
