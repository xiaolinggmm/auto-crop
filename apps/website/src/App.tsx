import {
  ArrowRight,
  Check,
  ChevronRight,
  CirclePause,
  Github,
  Layers3,
  LockKeyhole,
  Menu,
  MonitorDown,
  Play,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

const githubUrl = "https://github.com/xiaolinggmm/cordantry";
const downloadUrl = `${githubUrl}/releases/latest`;

const stages = ["Set direction", "Company plans", "Agents work", "Needs you", "Outcome"] as const;
type Stage = (typeof stages)[number];

const stageCopy: Record<Stage, { eyebrow: string; title: string; note: string }> = {
  "Set direction": {
    eyebrow: "Founder vision",
    title: "Launch our paid research product",
    note: "Find a sharp market position, ship the first usable version, and prepare a credible launch.",
  },
  "Company plans": {
    eyebrow: "CEO plan",
    title: "One goal becomes an operating plan",
    note: "Objectives, departments, dependencies, and proof requirements are ready.",
  },
  "Agents work": {
    eyebrow: "Company operating",
    title: "Work moves across departments",
    note: "Accepted research becomes Product's input. Engineering starts when the brief is ready.",
  },
  "Needs you": {
    eyebrow: "Founder decision",
    title: "Choose the launch position",
    note: "The team narrowed the market to two viable directions. This changes what gets built.",
  },
  Outcome: {
    eyebrow: "Founder report",
    title: "A launch-ready product, with the trail behind it",
    note: "The result, key decisions, accepted evidence, and remaining risks are in one place.",
  },
};

function Logo() {
  return (
    <a className="brand" href="#top" aria-label="Cordantry home">
      <span className="brand-mark" aria-hidden="true"><span /></span>
      <span>Cordantry</span>
    </a>
  );
}

function DirectionPanel() {
  return (
    <div className="direction-card">
      <div className="field-label">What are we building?</div>
      <p>Launch our paid research product</p>
      <div className="direction-details">Find a sharp market position, ship the first usable version, and prepare a credible launch.</div>
      <div className="demo-primary">Create company <ArrowRight size={15} /></div>
    </div>
  );
}

function PlanPanel() {
  return (
    <div className="plan-board" aria-label="Company plan">
      <div className="objective-node"><Sparkles size={15} /> Launch a paid research product</div>
      <div className="connector" aria-hidden="true" />
      <div className="department-row">
        <div className="department-card"><span className="agent-dot research" />Research<span>Position the product</span></div>
        <div className="department-card"><span className="agent-dot product" />Product<span>Shape the first offer</span></div>
        <div className="department-card"><span className="agent-dot build" />Engineering<span>Build and verify</span></div>
      </div>
    </div>
  );
}

function AgentsPanel() {
  const work = [
    ["Research", "Market position", "Accepted", "complete"],
    ["Product", "Offer & experience", "Working", "active"],
    ["Engineering", "Launch build", "Waiting for brief", "waiting"],
  ];
  return (
    <div className="agent-work-list">
      {work.map(([team, task, status, tone], index) => (
        <div className="agent-work" key={team}>
          <div className={`work-index ${tone}`}>{tone === "complete" ? <Check size={15} /> : index + 1}</div>
          <div><strong>{team}</strong><span>{task}</span></div>
          <span className={`work-status ${tone}`}>{status}</span>
        </div>
      ))}
      <div className="handoff-line"><ArrowRight size={14} /> Accepted work unlocks the next task</div>
    </div>
  );
}

function DecisionPanel() {
  return (
    <div className="decision-card">
      <div className="decision-context"><span>Recommended</span><strong>Lead with founder research</strong></div>
      <p>Clearer urgency and a narrower first product. The team can reuse the research already accepted.</p>
      <div className="decision-option"><i className="visual-radio selected" /> Founder research <span>Focused</span></div>
      <div className="decision-option"><i className="visual-radio" /> General market intelligence <span>Broader</span></div>
      <div className="demo-primary">Choose direction <ArrowRight size={15} /></div>
    </div>
  );
}

function OutcomePanel() {
  return (
    <div className="outcome-grid">
      <div className="report-card">
        <div className="report-check"><Check size={18} /></div>
        <div><span>Company outcome</span><strong>Launch package ready</strong></div>
      </div>
      <div className="report-card"><div><span>Delivered</span><strong>Positioning · Product · Launch plan</strong></div></div>
      <div className="report-card"><div><span>Founder decisions</span><strong>2 resolved · 0 waiting</strong></div></div>
      <div className="report-card risk"><div><span>Watch next</span><strong>First 10 customer conversations</strong></div><ChevronRight size={18} /></div>
    </div>
  );
}

const panels: Record<Stage, () => React.JSX.Element> = {
  "Set direction": DirectionPanel,
  "Company plans": PlanPanel,
  "Agents work": AgentsPanel,
  "Needs you": DecisionPanel,
  Outcome: OutcomePanel,
};

function ProductDemo() {
  const [stage, setStage] = useState<Stage>(stages[0]);
  const [playing, setPlaying] = useState(true);
  const StagePanel = panels[stage];

  useEffect(() => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (!playing || reducedMotion) return;
    const timer = window.setInterval(() => {
      setStage((current) => stages[(stages.indexOf(current) + 1) % stages.length]);
    }, 4600);
    return () => window.clearInterval(timer);
  }, [playing]);

  return (
    <section className="demo-section" id="product" aria-labelledby="demo-title">
      <div className="section-intro compact">
        <p className="eyebrow">Product walkthrough</p>
        <h2 id="demo-title">Set the direction. Keep the judgment.</h2>
      </div>
      <div className="demo-stage">
        <div className="demo-tabs" role="tablist" aria-label="Cordantry company workflow">
          {stages.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              id={`walkthrough-tab-${stages.indexOf(item)}`}
              aria-controls="walkthrough-panel"
              aria-selected={stage === item}
              className={stage === item ? "active" : ""}
              onClick={() => { setStage(item); setPlaying(false); }}
            >
              <span>{String(stages.indexOf(item) + 1).padStart(2, "0")}</span>{item}
            </button>
          ))}
          <button className="play-control" type="button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? "Pause walkthrough" : "Play walkthrough"}>
            {playing ? <CirclePause size={18} /> : <Play size={18} />}
          </button>
        </div>
        <div
          className="product-window"
          id="walkthrough-panel"
          role="tabpanel"
          tabIndex={0}
          aria-labelledby={`walkthrough-tab-${stages.indexOf(stage)}`}
        >
          <div className="product-rail" aria-hidden="true">
            <div className="rail-brand"><span className="brand-mark small"><span /></span></div>
            <div className="rail-nav active"><Layers3 size={18} /></div>
            <div className="rail-nav"><Sparkles size={18} /></div>
            <div className="rail-spacer" />
            <div className="avatar">F</div>
          </div>
          <div className="product-content">
            <header className="product-header">
              <div><span>Northstar Labs</span><strong>{stageCopy[stage].eyebrow}</strong></div>
              <div className="operating"><i /> Company operating</div>
            </header>
            <main className="product-main">
              <div className="stage-heading"><p>{stageCopy[stage].eyebrow}</p><h3>{stageCopy[stage].title}</h3><span>{stageCopy[stage].note}</span></div>
              <div className="stage-panel" key={stage}><StagePanel /></div>
            </main>
          </div>
        </div>
      </div>
    </section>
  );
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div id="top">
      <header className="site-header">
        <Logo />
        <nav className={menuOpen ? "site-nav open" : "site-nav"} aria-label="Main navigation">
          <a href="#product" onClick={() => setMenuOpen(false)}>Product</a>
          <a href="#difference" onClick={() => setMenuOpen(false)}>Why Cordantry</a>
          <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
          <a href={githubUrl} target="_blank" rel="noreferrer">GitHub</a>
        </nav>
        <a className="header-cta" href={downloadUrl}>Download <ArrowRight size={15} /></a>
        <button className="menu-button" type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen((value) => !value)}>
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>

      <main>
        <section className="hero">
          <div className="hero-orbit orbit-one" aria-hidden="true" />
          <div className="hero-orbit orbit-two" aria-hidden="true" />
          <p className="hero-kicker"><span /> Built for founders who want leverage, not another inbox</p>
          <h1>Run a company<br />of AI agents.</h1>
          <p className="founder-line">You are the founder.</p>
          <p className="hero-copy">Set the direction. Your Agent team plans, delegates, and moves the work forward. Cordantry brings you the decisions, progress, and results that matter—without making you manage every task.</p>
          <div className="hero-actions">
            <a className="primary-button" href="#product">Watch Cordantry work <ArrowRight size={17} /></a>
            <a className="secondary-button" href={downloadUrl}><MonitorDown size={17} /> Download Cordantry</a>
          </div>
          <a className="github-link" href={githubUrl} target="_blank" rel="noreferrer"><Github size={16} /> View on GitHub</a>
        </section>

        <ProductDemo />

        <section className="responsibility section" aria-labelledby="responsibility-title">
          <div className="section-intro">
            <p className="eyebrow">One clear boundary</p>
            <h2 id="responsibility-title">Your company runs.<br />You stay in control.</h2>
          </div>
          <div className="responsibility-grid">
            <article className="founder-card">
              <span className="card-number">You</span>
              <h3>Founder</h3>
              <ul><li>Set the vision</li><li>Make strategic calls</li><li>Grant sensitive permissions</li><li>Review company outcomes</li></ul>
            </article>
            <article className="company-card">
              <span className="card-number">C</span>
              <h3>Cordantry</h3>
              <ul><li>Turn direction into a plan</li><li>Assign work by role</li><li>Move accepted work downstream</li><li>Escalate only when judgment is needed</li></ul>
            </article>
          </div>
          <p className="role-note">A role-based Agent team coordinates responsibilities and handoffs. Cordantry does not depend on pretending every role must be a different model.</p>
        </section>

        <section className="difference section" id="difference" aria-labelledby="difference-title">
          <div className="section-intro">
            <p className="eyebrow">A different operating model</p>
            <h2 id="difference-title">Beyond prompts and pipelines.</h2>
          </div>
          <div className="comparison" role="table" aria-label="Cordantry product comparison">
            <div className="comparison-row head" role="row"><span role="columnheader"> </span><span role="columnheader">Workflow automation</span><span role="columnheader">Single Agent</span><span role="columnheader" className="cordantry-column">Cordantry</span></div>
            <div className="comparison-row" role="row"><strong role="rowheader">Starts with</strong><span>Rules</span><span>A prompt</span><span className="cordantry-column">A company goal</span></div>
            <div className="comparison-row" role="row"><strong role="rowheader">Coordinates</strong><span>Steps</span><span>One context</span><span className="cordantry-column">Roles, work, and handoffs</span></div>
            <div className="comparison-row" role="row"><strong role="rowheader">Brings you</strong><span>Exceptions</span><span>Every turn</span><span className="cordantry-column">Strategic decisions</span></div>
            <div className="comparison-row" role="row"><strong role="rowheader">Ends with</strong><span>A completed run</span><span>An answer</span><span className="cordantry-column">An accepted business outcome</span></div>
          </div>
        </section>

        <section className="use-cases section" aria-labelledby="use-cases-title">
          <div className="section-intro"><p className="eyebrow">Put the company to work</p><h2 id="use-cases-title">From direction to finished work.</h2></div>
          <div className="use-case-grid">
            <article><span>01</span><h3>Validate a new market</h3><p>Research the landscape, sharpen the position, and turn evidence into a founder decision.</p></article>
            <article><span>02</span><h3>Build a product release</h3><p>Coordinate product, engineering, and verification around accepted handoffs.</p></article>
            <article><span>03</span><h3>Prepare a launch</h3><p>Bring the offer, launch assets, and risks together in one founder report.</p></article>
          </div>
        </section>

        <section className="control section" aria-labelledby="control-title">
          <div className="control-copy"><p className="eyebrow">Local control</p><h2 id="control-title">Autonomy with an audit trail.</h2><p>Your work stays on your machine. Cordantry makes execution visible, asks before sensitive actions, and keeps proof behind every accepted result.</p></div>
          <div className="control-list">
            <div><MonitorDown /><span><strong>Local-first</strong>Runs from your computer and project.</span></div>
            <div><LockKeyhole /><span><strong>Permission-aware</strong>Sensitive actions remain explicit.</span></div>
            <div><ShieldCheck /><span><strong>Proof-gated</strong>Work advances on accepted evidence.</span></div>
            <div><CirclePause /><span><strong>Always stoppable</strong>Pause the company or stop active work.</span></div>
          </div>
        </section>

        <section className="faq section" id="faq" aria-labelledby="faq-title">
          <div className="section-intro"><p className="eyebrow">FAQ</p><h2 id="faq-title">Before you start.</h2></div>
          <div className="faq-list">
            <details><summary>Is Cordantry another AI chat app?<span>+</span></summary><p>No. It is a local company runtime that turns a goal into coordinated roles, tasks, handoffs, decisions, and verified outcomes.</p></details>
            <details><summary>Does it require several different AI models?<span>+</span></summary><p>No. “Agent team” describes role-based collaboration. The available execution backends can carry different responsibilities without making a model-count promise.</p></details>
            <details><summary>When does Cordantry interrupt me?<span>+</span></summary><p>When the company needs founder judgment, a sensitive permission, or a decision that materially changes the work. Routine coordination stays with the team.</p></details>
            <details><summary>Where does my work run?<span>+</span></summary><p>On your computer, against the local project you choose. Cordantry keeps the plan, execution state, proof, and reports visible in its dashboard.</p></details>
            <details><summary>What do I need to get started?<span>+</span></summary><p>Install Cordantry and have a supported local Agent CLI, such as Codex or Claude Code, installed and signed in.</p></details>
          </div>
        </section>

        <section className="final-cta">
          <div><p className="eyebrow">Your direction. A company in motion.</p><h2>Run your first<br />Agent company.</h2></div>
          <div className="final-actions"><a className="light-button" href={downloadUrl}>Download Cordantry <ArrowRight size={17} /></a><a href={githubUrl} target="_blank" rel="noreferrer"><Github size={17} /> View on GitHub</a></div>
        </section>
      </main>

      <footer><Logo /><span>Open source · Local first</span><span>© {new Date().getFullYear()} Cordantry</span></footer>
    </div>
  );
}

export default App;
