import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  ArrowRight,
  Play,
  ShieldCheck,
  X,
} from "lucide-react";
import { CompanyFlowPage } from "../components/company-flow";
import { Button, Card, Input, Label } from "../components/ui";
import { LanguageSwitch } from "../components/workbench/LanguageSwitch";
import { StoryScene } from "../components/onboarding/StoryScene";
import { storyCopy } from "../components/onboarding/storyCopy";
import { useLanguage } from "../ui/language";
import "./onboarding.css";

const draftKey = "cordantry.onboardingDraft";
function readDraft(): { name: string; vision: string; form: boolean } {
  try {
    const value = JSON.parse(sessionStorage.getItem(draftKey) ?? "null");
    if (
      value &&
      typeof value.name === "string" &&
      typeof value.vision === "string"
    )
      return { ...value, form: value.form === true };
  } catch {
    /* Storage can be unavailable; retain input in React for this visit. */
  }
  return { name: "", vision: "", form: false };
}

export function Onboarding({
  onCancel,
  review = false,
}: {
  onCancel?(): void;
  review?: boolean;
}) {
  const { language, t } = useLanguage();
  const launcher = useRef(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const modal = useRef<HTMLDivElement>(null);
  const c = storyCopy[language];
  const [draft, setDraft] = useState(readDraft);
  const [form, setForm] = useState(() => (review ? false : readDraft().form));
  const [scene, setScene] = useState(0);
  const [playback, setPlayback] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [reduced, setReduced] = useState(
    () =>
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  const duration = scene === 2 ? 10 : 12;
  const finished = reduced || elapsed >= duration;

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query?.matches ?? false);
    query?.addEventListener("change", update);
    return () => query?.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (form || finished) return;
    let frame: number;
    let previous: number | undefined;
    const tick = (now: number) => {
      // Clamp background-tab gaps so returning does not skip the sending action.
      const delta = previous === undefined ? 0 : Math.min((now - previous) / 1000, 0.05);
      previous = now;
      setElapsed((value) => Math.min(duration, value + delta));
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [form, finished, scene, duration]);
  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({ ...draft, form }));
    } catch {
      /* In-memory retention still works. */
    }
  }, [draft, form]);

  useEffect(() => {
    if (modal.current) modal.current.scrollTop = 0;
  }, [scene, form]);

  function selectScene(index: number) {
    if (modal.current) modal.current.scrollTop = 0;
    setPlayback((value) => value + 1);
    setScene(index);
    setElapsed(0);
  }
  function showForm() {
    setForm(true);
  }

  return (
    <>
      {!review && (
        <CompanyFlowPage
          eyebrow={t("onboarding.eyebrow")}
          title={t("app.title")}
          titleId="onboarding-background-title"
          status={c.policy}
          statusIcon={<ShieldCheck aria-hidden="true" />}
        >
          <Card className="grid gap-4 p-6">
            <h2 className="text-lg font-semibold">{c.formTitle}</h2>
            <p>{c.formDescription}</p>
            <div className="h-24 rounded-[var(--r-reading)] bg-muted" />
          </Card>
        </CompanyFlowPage>
      )}
      <Dialog.Root
        open
        onOpenChange={(open) => {
          if (!open) {
            if (onCancel) onCancel();
            else showForm();
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="story-overlay" />
          <Dialog.Content
            ref={modal}
            className="story-modal"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (launcher.current?.isConnected) launcher.current.focus();
            }}
            onPointerDownOutside={(event) => event.preventDefault()}
          >
            <div className="story-top">
              <span className="story-kicker">
                {form ? "Cordantry" : c.example}
              </span>
              <div className="story-top-actions">
                <LanguageSwitch />
                {!form && (
                  <Button variant="ghost" size="sm" onClick={showForm}>
                    {c.skip}
                    <ArrowRight aria-hidden="true" />
                  </Button>
                )}
                {onCancel && (
                  <Button
                    aria-label={c.close}
                    variant="ghost"
                    size="icon"
                    onClick={onCancel}
                  >
                    <X aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>
            <Dialog.Title className="story-title">
              {form ? c.formTitle : c.titles[scene]}
            </Dialog.Title>
            {form ? (
              <>
                <Dialog.Description className="text-sm text-muted-foreground">
                  {c.formDescription}
                </Dialog.Description>
                <form
                  className="story-form"
                  onSubmit={(event) => event.preventDefault()}
                >
                  <div>
                    <Label htmlFor="company-name">{c.name}</Label>
                    <Input
                      id="company-name"
                      autoComplete="organization"
                      placeholder={c.namePlaceholder}
                      value={draft.name}
                      onChange={(event) =>
                        setDraft({ ...draft, name: event.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="founder-vision">{c.goal}</Label>
                    <textarea
                      id="founder-vision"
                      className="story-vision"
                      placeholder={c.goalPlaceholder}
                      value={draft.vision}
                      onChange={(event) =>
                        setDraft({ ...draft, vision: event.target.value })
                      }
                    />
                  </div>
                  <div className="story-note" role="status">
                    <strong>{c.unavailable}</strong>
                    <p>{c.boundary}</p>
                  </div>
                  <div className="story-form-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        selectScene(0);
                        setForm(false);
                      }}
                    >
                      <Play aria-hidden="true" />
                      {c.watch}
                    </Button>
                    <Button type="submit" disabled>
                      {c.generate}
                      <ArrowRight aria-hidden="true" />
                    </Button>
                  </div>
                  <p className="story-fine">{c.draft}</p>
                </form>
              </>
            ) : (
              <>
                <StoryScene
                  key={playback}
                  scene={scene}
                  elapsed={elapsed}
                  reduced={reduced}
                  c={c}
                />
                <Dialog.Description className="story-description">
                  {c.descriptions[scene]}
                </Dialog.Description>
                <nav
                  className="story-progress"
                  aria-label={language === "zh" ? "演示章节" : "Demo chapters"}
                >
                  {c.steps.map((label, index) => (
                    <button
                      key={label}
                      aria-current={index === scene ? "step" : undefined}
                      onClick={() => selectScene(index)}
                    >
                      <span className="story-progress-track">
                        <span
                          style={{
                            width:
                              index < scene
                                ? "100%"
                                : index === scene
                                  ? `${finished ? 100 : (elapsed / duration) * 100}%`
                                  : "0%",
                          }}
                        />
                      </span>
                      {index + 1} · {label}
                    </button>
                  ))}
                </nav>
                <div className="story-navigation">
                  <Button
                    variant="ghost"
                    disabled={scene === 0}
                    onClick={() => selectScene(scene - 1)}
                  >
                    <ArrowLeft aria-hidden="true" />
                    {c.back}
                  </Button>
                  <Button
                    onClick={() =>
                      scene === 3 ? showForm() : selectScene(scene + 1)
                    }
                  >
                    {scene === 3 ? c.create : c.next}
                    <ArrowRight aria-hidden="true" />
                  </Button>
                </div>
                <p className="story-fine">{c.disclaimer}</p>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
