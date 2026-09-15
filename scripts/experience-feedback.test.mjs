import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const engine = readFileSync(new URL("../src/lib/experience-feedback.ts", import.meta.url), "utf8");
const controls = readFileSync(
  new URL("../src/components/experience-controls.tsx", import.meta.url),
  "utf8",
);
const quiz = readFileSync(new URL("../src/components/quiz-player.tsx", import.meta.url), "utf8");
const milestones = readFileSync(
  new URL("../src/components/experience-milestone-bridge.tsx", import.meta.url),
  "utf8",
);
const motionBridge = readFileSync(
  new URL("../src/components/experience-motion-bridge.tsx", import.meta.url),
  "utf8",
);
const root = readFileSync(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../src/components/shell.tsx", import.meta.url), "utf8");
const profile = readFileSync(new URL("../src/routes/profil.tsx", import.meta.url), "utf8");
const premium = readFileSync(new URL("../src/routes/pro.tsx", import.meta.url), "utf8");
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

test("focus ambience is explicit session-only audio with a stop control", () => {
  assert.match(engine, /startFocusAmbience/);
  assert.match(engine, /stopFocusAmbience/);
  assert.match(engine, /FOCUS_INTERVAL_MS/);
  assert.match(engine, /visibilitychange/);
  assert.match(engine, /pagehide/);
  assert.doesNotMatch(engine, /localStorage\.setItem\([^\n]*focus/i);
  assert.match(controls, /Ambiance focus/);
  assert.match(controls, /uniquement pour cette session/);
});

test("quiz emits distinct correct incorrect completion and combo feedback", () => {
  assert.match(quiz, /emitExperienceFeedback\(isOk \? "correct" : "incorrect"/);
  assert.match(quiz, /emitExperienceFeedback\("complete"/);
  assert.match(quiz, /optimus-answer-correct/);
  assert.match(quiz, /optimus-answer-incorrect/);
  assert.match(quiz, /combo >= 2/);
  assert.match(quiz, /optimus-combo-pulse/);
});

test("milestones combine sensory cues with restrained visual celebration", () => {
  assert.match(milestones, /toast\.success\("Badge débloqué"/);
  assert.match(milestones, /toast\.success\("Niveau supérieur"/);
  assert.match(milestones, /toast\.success\("Optimus Premium activé"/);
  assert.match(milestones, /emitExperienceFeedback\("premium"/);
  assert.match(milestones, /emitExperienceFeedback\("badge"/);
});

test("motion feedback honors both app and operating-system reduced motion", () => {
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /data-optimus-motion="reduced"/);
  assert.match(styles, /optimus-answer-correct/);
  assert.match(styles, /optimus-answer-incorrect/);
  assert.match(styles, /optimus-session-complete/);
  assert.match(styles, /optimus-nav-active/);
  assert.match(styles, /optimus-combo-pulse/);
  assert.match(shell, /preferences\.enhancedMotion && active && "optimus-nav-active"/);
  assert.match(motionBridge, /dataset\.optimusMotion/);
  assert.match(root, /<ExperienceMotionBridge \/>/);
});

test("profile exposes clear study-comfort controls", () => {
  assert.match(profile, /Confort d’étude/);
  assert.match(profile, /Expérience sensorielle/);
  assert.match(profile, /<ExperienceControls \/>/);
});

test("Premium active state is user-facing rather than technical debug copy", () => {
  assert.match(premium, /Premium actif/);
  assert.match(premium, /Accès confirmé/);
  assert.doesNotMatch(premium, /Statut local vérifié/);
});
