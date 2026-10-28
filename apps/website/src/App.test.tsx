// @vitest-environment jsdom
import "./test/setup";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("shows the complete company loop without promising a specific model topology", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Set the direction. Keep the judgment." })).toBeVisible();
    expect(screen.getByText("Company plans")).toBeVisible();
    expect(screen.getByText("Agents work")).toBeVisible();
    expect(screen.getByText("Needs you")).toBeVisible();
    expect(screen.getByText("Outcome")).toBeVisible();
    expect(screen.getByText(/role-based Agent team/i)).toBeVisible();
  });

  it("lets the founder inspect a stage and pauses the walkthrough", async () => {
    const user = userEvent.setup();
    render(<App />);

    const needsYou = screen.getByRole("tab", { name: /Needs you/ });
    await user.click(needsYou);

    expect(needsYou).toHaveAttribute("aria-selected", "true");
    expect(needsYou).toHaveAttribute("aria-controls", "walkthrough-panel");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "walkthrough-panel");
    expect(screen.getByRole("heading", { name: "Choose the launch position" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Play walkthrough" })).toBeVisible();
  });
});
