// @vitest-environment jsdom
import "../test/setup";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { LanguageProvider } from "../ui/language";
import { Settings, type SettingsProps } from "./Settings";

function mount(overrides: Partial<SettingsProps> = {}) {
  const props: SettingsProps = {
    company: {id: "co", name: "Studio", status: "active", playbookId: "custom", executionMode: "mah", mahConfig: {projectRoot: "/old/project", cliPath: "mah", slotClass: "background", projectId: "project-1"}},
    companies: [], companiesLoadState: "ready", companiesLoadError: null,
    onLoadCompanies: vi.fn(), onOpenCompany: vi.fn(), onCreateNewCompany: vi.fn(),
    stopCommand: {id: "stop-operating", enabled: false, labelKey: "settings.stopOperating", run: vi.fn()},
    ...overrides,
  };
  return render(<LanguageProvider><Settings {...props} /></LanguageProvider>);
}

it("shows immutable execution mode and only saves repaired paths after server validation", async () => {
  const repair = vi.fn().mockRejectedValueOnce(new Error("Choose the original MAH project (project-1)."));
  const user = userEvent.setup();
  mount({onRepairMahConnection: repair});
  expect(screen.getByText("MAH coordination (advanced)", {exact: true})).toBeInTheDocument();
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  await user.clear(screen.getByLabelText("MAH project root"));
  await user.type(screen.getByLabelText("MAH project root"), "/moved/project");
  await user.click(screen.getByRole("button", {name: "Validate and save connection"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("Choose the original MAH project");
  expect(screen.getByLabelText("MAH project root")).toHaveValue("/moved/project");
  expect(repair).toHaveBeenCalledWith({projectRoot: "/moved/project", cliPath: "mah"});
  repair.mockResolvedValueOnce(undefined);
  await user.click(screen.getByRole("button", {name: "Validate and save connection"}));
  expect(await screen.findByText("Connection saved.")).toBeInTheDocument();
});

it("shows Direct for legacy companies without offering MAH conversion", () => {
  mount({company: {id: "legacy", name: "Legacy", status: "active", playbookId: "custom"}});
  expect(screen.getByText("Direct dispatch (default)", {exact: true})).toBeInTheDocument();
  expect(screen.queryByLabelText("MAH project root")).not.toBeInTheDocument();
});
