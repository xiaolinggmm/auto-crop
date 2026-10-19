import { Check, Circle, MessageSquare, Network } from "lucide-react";
import { CoordinationScene } from "./CoordinationScene";
import { ParallelScene } from "./ParallelScene";
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
        <ParallelScene elapsed={elapsed} reduced={reduced} c={c} />
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
