// @vitest-environment jsdom
import "./test/setup";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("Cordantry landing page", () => {
  it("frames the visitor as the founder and links to the product", () => {
    const { container } = render(<App />);

    expect(screen.getByRole("heading", { level: 1, name: "Run a company of AI agents." })).toBeVisible();
    expect(screen.getByText("You are the founder.")).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Download Cordantry" })).not.toHaveLength(0);
    for (const link of screen.getAllByRole("link", { name: "Download Cordantry" })) {
      expect(link).toHaveAttribute("href", "https://github.com/xiaolinggmm/cordantry/releases/latest");
    }
    expect(screen.getAllByRole("link", { name: "View on GitHub" })).not.toHaveLength(0);
    for (const link of screen.getAllByRole("link", { name: "View on GitHub" })) {
      expect(link).toHaveAttribute("href", "https://github.com/xiaolinggmm/cordantry");
    }
    expect(container).not.toHaveTextContent("Auto-Crop");
  });

  it("shows the company loop as one low-effort illustration instead of feature tabs", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "One direction. A company in motion." })).toBeVisible();
    const illustration = screen.getByRole("img", { name: "Cordantry operating loop" });
    expect(within(illustration).getByText("Founder direction")).toBeVisible();
    expect(within(illustration).getByText("Company operating")).toBeVisible();
    expect(within(illustration).getByText("CEO Agent")).toBeVisible();
    expect(within(illustration).getAllByLabelText("Codex Agent")).not.toHaveLength(0);
    expect(within(illustration).getAllByLabelText("Claude Code Agent")).not.toHaveLength(0);
    expect(within(illustration).getAllByLabelText("Antigravity Agent")).not.toHaveLength(0);
    expect(within(illustration).queryByText("Codex")).not.toBeInTheDocument();
    expect(within(illustration).queryByText("Claude Code")).not.toBeInTheDocument();
    expect(within(illustration).getByText("Needs you")).toBeVisible();
    expect(within(illustration).getByText("Outcome")).toBeVisible();
    expect(within(illustration).queryByRole("tab")).not.toBeInTheDocument();
    expect(within(illustration).queryByRole("button")).not.toBeInTheDocument();
  });

  it("explains founder control as one continuous operating sequence", () => {
    render(<App />);

    expect(screen.getByText("You set direction. Cordantry carries the work.")).toBeVisible();
    const loop = screen.getByRole("img", { name: "Founder control loop" });
    expect(within(loop).getByText("Founder")).toBeVisible();
    expect(within(loop).getByRole("img", { name: "Founder" })).toBeVisible();
    expect(within(loop).getByRole("img", { name: "CEO Agent" })).toBeVisible();
    expect(within(loop).getByText("Your direction")).toBeVisible();
    expect(within(loop).getByText("Company running")).toBeVisible();
    expect(within(loop).getByText("Needs your judgment")).toBeVisible();
    expect(within(loop).getByText("Founder report ready")).toBeVisible();
    expect(screen.queryByText("Grant sensitive permissions")).not.toBeInTheDocument();
    expect(loop.querySelectorAll("[data-phase]")).toHaveLength(0);
    expect(loop.querySelector(".send-orb")).toBeInTheDocument();
    expect(loop.querySelectorAll(".agent-arrival")).toHaveLength(4);
    expect(Array.from(loop.querySelectorAll(".agent-role")).map((role) => role.textContent)).toEqual(["CEO", "Research", "Product", "Build"]);
    expect(loop.querySelector(".permission-moment")).toBeInTheDocument();
    expect(loop.querySelector(".ceo-result")).toBeInTheDocument();
    expect(loop.querySelector(".control-tracks")).not.toBeInTheDocument();
  });

  it("keeps FAQ inside the navigation instead of making it a page section", () => {
    render(<App />);

    expect(screen.queryByRole("heading", { name: "Before you start." })).not.toBeInTheDocument();
    const faqButton = screen.getByRole("button", { name: "FAQ" });
    expect(faqButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(faqButton);

    expect(faqButton).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByRole("dialog", { name: "Frequently asked questions" });
    expect(within(panel).getByText("Is Cordantry another AI chat app?")).toBeVisible();
  });

  it("uses a compact visual to explain local control", () => {
    render(<App />);

    const visual = screen.getByRole("img", { name: "Local control flow" });
    expect(within(visual).getByText("Your project")).toBeVisible();
    expect(within(visual).getByText("Permission gate")).toBeVisible();
    expect(within(visual).getByText("Accepted proof")).toBeVisible();
    expect(screen.queryByText(/Your work stays on your machine/)).not.toBeInTheDocument();
  });
});
