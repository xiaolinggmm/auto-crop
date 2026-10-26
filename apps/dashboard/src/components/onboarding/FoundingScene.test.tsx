// @vitest-environment jsdom
import "../../test/setup";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { StoryScene } from "./StoryScene";
import { storyCopy } from "./storyCopy";

it.each(["en", "zh"] as const)("shows sending before the CEO plan in %s", (language) => {
  const c = storyCopy[language];
  const scene = (elapsed: number, reduced = false) => <StoryScene scene={0} elapsed={elapsed} reduced={reduced} c={c} />;
  const view = render(scene(1));
  expect(screen.getByRole("textbox").textContent!.length).toBeLessThan(c.foundingVision.length);
  expect(screen.getByTestId("typing-caret")).toBeInTheDocument();
  expect(screen.queryByText("T01")).not.toBeInTheDocument();
  view.rerender(scene(3.9));
  expect(screen.getByRole("textbox")).toHaveTextContent(c.foundingVision);
  expect(screen.queryByTestId("typing-caret")).not.toBeInTheDocument();
  expect(screen.getByText(language === "zh" ? "发送给 CEO" : "Send to CEO")).toBeInTheDocument();
  view.rerender(scene(5.2));
  expect(screen.getByText(language === "zh" ? "CEO 已收到目标" : "CEO received your goal")).toBeInTheDocument();
  expect(screen.queryByText("T01")).not.toBeInTheDocument();
  view.rerender(scene(10));
  expect(screen.getByText(language === "zh" ? "由 CEO 拆解 · 14 个任务" : "14 tasks planned by CEO")).toBeInTheDocument();
  expect(screen.getByText(language === "zh" ? "调研完成后" : "After research")).toBeInTheDocument();
  expect(screen.getByText(language === "zh" ? "+ 10 个任务 · 开发、上线与验证" : "+ 10 tasks · Build, launch & validate")).toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(4);
  view.rerender(scene(0, true));
  expect(screen.getAllByRole("listitem")).toHaveLength(4);
  expect(screen.queryByTestId("typing-caret")).not.toBeInTheDocument();
});
