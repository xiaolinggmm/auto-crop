import { Check, Circle, Globe, MessageSquare, Network } from "lucide-react";
import { CoordinationScene } from "./CoordinationScene";
import { FoundingScene } from "./FoundingScene";
import type { StoryCopy } from "./storyCopy";

export function StoryScene({
  scene,
  elapsed,
  reduced,
  c,
}: {
  scene: number;
  elapsed: number;
  reduced: boolean;
  c: StoryCopy;
}) {
  const phase = reduced
    ? 2
    : elapsed < 3
      ? 0
      : elapsed < (scene === 1 ? 9 : 6)
        ? 1
        : 2;
  return (
    <div className="story-stage" aria-label={c.titles[scene]}>
      {scene === 0 && (
        <FoundingScene elapsed={elapsed} reduced={reduced} c={c} />
      )}
      {scene === 1 && (
        <CoordinationScene elapsed={elapsed} reduced={reduced} c={c} />
      )}
      {scene === 2 && (
        <>
          <div className="story-browser">
            <div className="story-browser-bar">
              <span>● ● ●</span>
              <span>
                <Globe aria-hidden="true" /> firstsearch.example
              </span>
            </div>
            <div className="story-browser-body">
              <h3>Check your shipping address</h3>
              <div className="story-address">
                {phase === 0 ? (
                  <div className="story-skeleton" aria-hidden="true">
                    <span />
                    <span />
                  </div>
                ) : (
                  <>
                    42 Example Street
                    <br />
                    Sample City, CA {phase === 2 ? "90210" : "_____"}
                  </>
                )}
              </div>
              {phase >= 1 && (
                <p className="story-result">
                  {phase === 2 ? (
                    <Check aria-hidden="true" />
                  ) : (
                    <Circle aria-hidden="true" />
                  )}
                  {phase === 2 ? c.valid : c.missing}
                </p>
              )}
              <small>{c.limitation}</small>
            </div>
          </div>
          {phase === 2 && (
            <div className="story-delivery">
              <div>
                <strong>{c.delivery}</strong>
                {c.outputs.map((text) => (
                  <p key={text}>
                    <Check aria-hidden="true" />
                    {text}
                  </p>
                ))}
              </div>
              <div>
                {c.statuses.map((text) => (
                  <p key={text}>{text}</p>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {scene === 3 && (
        <>
          <span className="story-kicker">{c.later}</span>
          <div className="story-message">
            <MessageSquare aria-hidden="true" />
            <p>{c.feedback}</p>
          </div>
          <div className="story-note">
            <p>{c.founder}</p>
          </div>
          {phase >= 1 && (
            <div className="story-message">
              <Network aria-hidden="true" />
              <p>{c.verify}</p>
            </div>
          )}
          {phase === 2 && (
            <div className="story-browser story-batch">
              <h3>{c.batch}</h3>
              {c.rows.map((text, index) => (
                <p key={text}>
                  {index === 1 ? (
                    <Circle aria-hidden="true" />
                  ) : (
                    <Check aria-hidden="true" />
                  )}
                  {text}
                </p>
              ))}
              <small>{c.limitation}</small>
            </div>
          )}
        </>
      )}
    </div>
  );
}
