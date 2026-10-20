import "../test/setup";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { LanguageProvider } from "../ui/language";
import { Onboarding } from "./Onboarding";

function mount() {
  return render(
    <LanguageProvider>
      <Onboarding />
    </LanguageProvider>,
  );
}
afterEach(() => vi.useRealTimers());

it("skips to a combined blank form and retains input through replay and remount", async () => {
  const user = userEvent.setup();
  const view = mount();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Create directly" }));
  expect(screen.getByLabelText("Company name")).toHaveValue("");
  expect(screen.getByLabelText("Founder vision")).toHaveValue("");
  await user.type(screen.getByLabelText("Company name"), "My studio");
  await user.type(screen.getByLabelText("Founder vision"), "A real goal");
  expect(
    screen.getByRole("button", { name: "Generate team and plan" }),
  ).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Watch the demo" }));
  await user.click(screen.getByRole("button", { name: "Create directly" }));
  expect(screen.getByLabelText("Company name")).toHaveValue("My studio");
  view.unmount();
  mount();
  expect(screen.getByLabelText("Founder vision")).toHaveValue("A real goal");
});

it("returns a scrolled modal to the start when changing scene or opening the form", () => {
  mount();
  const dialog = screen.getByRole("dialog");
  dialog.scrollTop = 240;
  fireEvent.click(screen.getByRole("button", { name: "1 · Plan" }));
  expect(dialog.scrollTop).toBe(0);
  dialog.scrollTop = 240;
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(dialog.scrollTop).toBe(0);
  dialog.scrollTop = 200;
  fireEvent.click(screen.getByRole("button", { name: "Create directly" }));
  expect(dialog.scrollTop).toBe(0);
});

it("omits playback controls, stops at the result and restarts from a chapter", () => {
  vi.useFakeTimers();
  const view = mount();
  expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Replay" })).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(12500));
  expect(screen.getByText("14 tasks planned by CEO")).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Make complex goals clear." }),
  ).toBeInTheDocument();
  expect(screen.queryByText("Demo complete")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "1 · Plan" }));
  expect(screen.queryByText("14 tasks planned by CEO")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  act(() => vi.advanceTimersByTime(12000));
  expect(screen.getByText("Assigned by task requirements")).toBeInTheDocument();
  view.unmount();
  // Radix schedules focus restoration on unmount; flush that one-shot callback.
  act(() => vi.runOnlyPendingTimers());
  expect(vi.getTimerCount()).toBe(0);
});

it("shows complete static scenes with reduced motion and supports direct navigation", () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  mount();
  expect(screen.getByText("14 tasks planned by CEO")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "2 · Assign" }));
  expect(screen.getByText("CEO assigns tasks")).toBeInTheDocument();
  expect(screen.getByText("Codex")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "4 · Decide" }));
  expect(screen.getByText("Delivery verified")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Create my company" }),
  ).toBeInTheDocument();
  vi.unstubAllGlobals();
});
