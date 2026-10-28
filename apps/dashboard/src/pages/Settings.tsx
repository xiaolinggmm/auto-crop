import { Building2, Check, Languages, Plus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { CompanyListItem, CompanySummary } from "../api/client";
import { Alert, AlertDescription, AlertTitle, Button, Input, Label } from "../components/ui";
import { StatusTag } from "../components/ice-mist";
import { CompanyStatus } from "../components/workbench/CompanyStatus";
import { LanguageSwitch } from "../components/workbench/LanguageSwitch";
import { StopOperatingConfirm } from "../components/workbench/StopOperatingConfirm";
import type { WorkbenchCommand } from "../components/workbench/workbenchCommands";
import { WorkbenchSection } from "../components/workbench/WorkbenchSection";
import { useLanguage } from "../ui/language";

export type SettingsProps = {
  company: CompanySummary;
  companies: CompanyListItem[];
  companiesLoadState: "loading" | "ready" | "failed";
  companiesLoadError: string | null;
  onLoadCompanies(): void;
  onOpenCompany(companyId: string): void;
  onCreateNewCompany(): void;
  onReviewOnboarding?(): void;
  onRepairMahConnection?(input: {projectRoot: string; cliPath: string}): Promise<void>;
  stopCommand: WorkbenchCommand;
};

/** The current company, every company, and the interface language (dashboard ADR 0002). */
export function Settings({
  companies,
  companiesLoadError,
  companiesLoadState,
  company,
  onCreateNewCompany,
  onReviewOnboarding,
  onRepairMahConnection,
  onLoadCompanies,
  onOpenCompany,
  stopCommand,
}: SettingsProps) {
  const { t, language } = useLanguage();
  const zh = language === "zh";
  const [projectRoot, setProjectRoot] = useState(company.mahConfig?.projectRoot ?? "");
  const [cliPath, setCliPath] = useState(company.mahConfig?.cliPath ?? "mah");
  const [saving, setSaving] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setProjectRoot(company.mahConfig?.projectRoot ?? "");
    setCliPath(company.mahConfig?.cliPath ?? "mah");
    setConnectionError(null);
  }, [company.id, company.mahConfig?.projectRoot, company.mahConfig?.cliPath]);

  useEffect(() => {
    onLoadCompanies();
    // The list is read each time Settings opens; it is not kept live.
  }, []);

  return (
    <div className="grid gap-4">
      <WorkbenchSection icon={<Building2 aria-hidden="true" />} title={t("settings.currentCompany")}>
        <div className="grid gap-1">
          <p className="break-words text-[15px] font-semibold">{company.name}</p>
          <CompanyStatus status={company.status} />
        </div>
        <StopOperatingConfirm command={stopCommand} companyName={company.name} />
      </WorkbenchSection>

      <WorkbenchSection icon={<Building2 aria-hidden="true" />} title={zh ? "执行模式" : "Execution mode"}>
        <p className="font-semibold">{company.executionMode === "mah" ? (zh ? "高级模式 · MAH 协调" : "MAH coordination (advanced)") : (zh ? "默认模式 · 直接派发" : "Direct dispatch (default)")}</p>
        <p className="text-sm text-muted-foreground">{zh ? "公司创建后不能切换执行模式或 MAH 项目。如需切换，请创建新公司。" : "Execution mode and MAH project cannot change after creation. Create a new company to use a different mode or project."}</p>
        {company.executionMode === "mah" && <form className="grid gap-3" onSubmit={async event => {
          event.preventDefault();
          if (!onRepairMahConnection || saving) return;
          setSaving(true); setSaved(false); setConnectionError(null);
          try {
            await onRepairMahConnection({projectRoot: projectRoot.trim(), cliPath: cliPath.trim() || "mah"});
            setSaved(true);
          } catch (error) {
            setConnectionError(error instanceof Error ? error.message : String(error));
          } finally { setSaving(false); }
        }}>
          <p className="text-sm">{zh ? "可修复连接路径。服务器会验证路径仍指向原 MAH 项目。" : "Repair connection paths here. The server verifies they still identify the original MAH project."}</p>
          <p className="break-all text-sm">{zh ? "项目 ID：" : "Project ID: "}{company.mahConfig?.projectId ?? "—"} · {company.mahConfig?.slotClass ?? "background"}</p>
          <Label htmlFor="settings-mah-root">{zh ? "MAH 项目根目录" : "MAH project root"}</Label>
          <Input id="settings-mah-root" required value={projectRoot} disabled={saving} onChange={event => {setProjectRoot(event.target.value); setSaved(false);}} />
          <Label htmlFor="settings-mah-cli">{zh ? "MAH 可执行文件" : "MAH executable"}</Label>
          <Input id="settings-mah-cli" value={cliPath} disabled={saving} onChange={event => {setCliPath(event.target.value); setSaved(false);}} />
          {connectionError && <Alert role="alert" variant="danger">{connectionError}</Alert>}
          {saved && <p role="status">{zh ? "连接已保存。" : "Connection saved."}</p>}
          <Button type="submit" disabled={saving || !projectRoot.trim() || !onRepairMahConnection}>{saving ? (zh ? "验证中…" : "Validating…") : (zh ? "验证并保存连接" : "Validate and save connection")}</Button>
        </form>}
      </WorkbenchSection>

      <WorkbenchSection icon={<Building2 aria-hidden="true" />} title={t("settings.allCompanies")}>
        {companiesLoadState === "loading" ? <Alert role="status">{t("settings.loadingCompanies")}</Alert> : null}
        {companiesLoadState === "failed" ? (
          <Alert role="status" variant="danger">
            <AlertTitle>{t("settings.companiesFailed")}</AlertTitle>
            {companiesLoadError ? <AlertDescription>{companiesLoadError}</AlertDescription> : null}
          </Alert>
        ) : null}
        {companies.length > 0 ? (
          <ul className="grid gap-2">
            {companies.map((item) => {
              const isCurrent = item.id === company.id;
              return (
                <li key={item.id}>
                  <button
                    aria-current={isCurrent ? "true" : undefined}
                    className="grid w-full gap-1.5 rounded-[var(--r-reading)] bg-[color:var(--surface-reading)] px-4 py-3 text-left transition-colors duration-[var(--dur)] hover:bg-[color:var(--c-ice)] focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none disabled:cursor-default disabled:hover:bg-[color:var(--surface-reading)]"
                    disabled={isCurrent}
                    onClick={() => onOpenCompany(item.id)}
                    type="button"
                  >
                    <span className="flex flex-wrap items-center gap-2 text-[15px] font-medium">
                      {item.name}
                      {isCurrent ? (
                        <StatusTag icon={Check} tone="queued">
                          {t("settings.current")}
                        </StatusTag>
                      ) : null}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                      <CompanyStatus status={item.status} />
                      <span>
                        {item.taskCount} {t("settings.tasks")}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          {companiesLoadState === "failed" ? (
            <Button onClick={() => onLoadCompanies()} variant="outline">
              <RefreshCw aria-hidden="true" />
              {t("onboarding.retry")}
            </Button>
          ) : null}
          {onReviewOnboarding && <Button variant="ghost" onClick={onReviewOnboarding}>{language === "zh" ? "回看演示" : "Watch the demo"}</Button>}
          <Button onClick={onCreateNewCompany}>
            <Plus aria-hidden="true" />
            {t("settings.createNewCompany")}
          </Button>
        </div>
      </WorkbenchSection>

      <WorkbenchSection icon={<Languages aria-hidden="true" />} title={t("settings.language")}>
        <LanguageSwitch />
      </WorkbenchSection>
    </div>
  );
}
