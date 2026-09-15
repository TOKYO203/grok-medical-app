import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const engine = readFileSync(new URL("../src/lib/experience-feedback.ts", import.meta.url), "utf8");
const controls = readFileSync(
  new URL("../src/components/experience-controls.tsx", import.meta.url),
  "utf8",
);
const quiz = readFileSync(new URL("../src/components/quiz-player.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

test("sensory feedback is user-configurable and local-only", () => {
  assert.match(engine, /optimus-experience-v1/);
  assert.match(engine, /sounds:\s*true/);
  assert.match(engine, /haptics:\s*true/);
  assert.match(engine, /enhancedMotion:\s*true/);
  assert.match(controls, /Désactiver les sons|Activer les sons/);
  assert.match(controls, /Désactiver les vibrations|Activer les vibrations/);
});

test("audio feedback is synthesized instead of relying on external media files", () => {
  assert.match(engine, /AudioContext/);
  assert.match(engine, /createOscillator/);
  assert.match(engine, /createGain/);
  assert.doesNotMatch(engine, /\.mp3|\.wav|\.ogg/);
});

test("quiz emits distinct correct incorrect and completion feedback", () => {
  assert.match(quiz, /emitExperienceFeedback\(isOk \? "correct" : "incorrect"/);
  assert.match(quiz, /emitExperienceFeedback\("complete"/);
  assert.match(quiz, /optimus-answer-correct/);
  assert.match(quiz, /optimus-answer-incorrect/);
});

test("motion feedback keeps the system reduced-motion escape hatch", () => {
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /optimus-answer-correct/);
  assert.match(styles, /optimus-answer-incorrect/);
  assert.match(styles, /optimus-session-complete/);
});
