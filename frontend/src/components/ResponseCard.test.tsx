import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ResponseCard } from "@/components/ResponseCard";

describe("<ResponseCard />", () => {
  it("renders nothing on idle", () => {
    const { container } = render(
      <ResponseCard status="idle" content={null} model={null} error={null} />,
    );

    expect(container.textContent).toBe("");
  });

  it("renders a thinking indicator on loading", () => {
    render(
      <ResponseCard status="loading" content={null} model={null} error={null} />,
    );

    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
  });

  it("renders markdown headings, code, and the model footer on success", () => {
    const content = "# Title\n\nSome `inline code` here.";
    render(
      <ResponseCard
        status="success"
        content={content}
        model="gpt-4o-mini"
        error={null}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: /Title/ })).toBeInTheDocument();
    expect(screen.getByText("inline code")).toBeInTheDocument();
    expect(screen.getByText(/via gpt-4o-mini/i)).toBeInTheDocument();
  });

  it("renders error text inside an alert region", () => {
    render(
      <ResponseCard
        status="error"
        content={null}
        model={null}
        error="Backend exploded"
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Backend exploded");
  });
});
