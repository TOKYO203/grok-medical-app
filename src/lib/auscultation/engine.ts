/* ═══════════════════════════════════════════════════════════════════
   Moteur audio — Auscultation
   ───────────────────────────────────────────────────────────────────
   Synthèse des bruits du cœur (et, à terme, des sons pulmonaires) sans
   aucun fichier audio embarqué : OscillatorNode (clics valvulaires) +
   AudioBufferSourceNode de bruit blanc (souffles / roulements) traversant
   un BiquadFilterNode (passe-bande / passe-bas) et un GainNode (enveloppe).

   Contrainte navigateur : un AudioContext ne démarre qu'après un geste
   utilisateur → il est créé LAZILY au premier appel de playSound().

   v2 : dix presets (B1-B2 normal, dédoublement B2, galops B3/B4, souffles
   holosystolique / protodiastolique / d'éjection, roulement + COM, frottement
   péricardique, arythmie irrégulière rapide). Chaque preset est une fonction
   PURE du params ; tous les nœuds audio produits sont traqués et coupés par
   stop().

   Utilisation :
     playSound("normal_s1s2", { bpm: 72, s1Freq: 42 });
     playSound("holosystolic_blowing", { murmurFreq: 430 });
     stop();          // coupe le son en cours
     isPlaying();     // un son est-il en cours ?
   ═══════════════════════════════════════════════════════════════════ */

export type SoundParams = {
  /** Fréquence cardiaque (battements / minute). */
  bpm?: number;
  /** Durée de la systole, donc décalage B1 → B2 (ms). */
  systoleMs?: number;
  /** Durée de la diastole (ms). Utilisée pour le libellé du schéma. */
  diastoleMs?: number;
  /** Fréquence du premier bruit B1 (Hz). */
  s1Freq?: number;
  /** Fréquence du second bruit B2 (Hz). */
  s2Freq?: number;
  /** Amplitude relative de B1 (0 → 1). */
  s1Gain?: number;
  /** Amplitude relative de B2 (0 → 1). */
  s2Gain?: number;
  /** Durée de la décroissance de B1 (s). */
  s1Dur?: number;
  /** Durée de la décroissance de B2 (s). */
  s2Dur?: number;
  /** Fréquence de coupure du filtre passe-bas (Hz) — timbre « sourd ». */
  filterFreq?: number;
  /** Résonance du filtre passe-bas. */
  filterQ?: number;
  /** Dédoublement de B2 : décalage A2 → P2 (ms). */
  splitMs?: number;
  /** Fréquence de la composante P2 du dédoublement (Hz). */
  p2Freq?: number;
  /** B3 (galop protodiastolique) : fréquence (Hz). */
  s3Freq?: number;
  /** B3 : amplitude relative. */
  s3Gain?: number;
  /** B3 : durée de décroissance (s). */
  s3Dur?: number;
  /** B3 : délai après B2 (ms). */
  s3DelayMs?: number;
  /** B4 (galop présystolique) : fréquence (Hz). */
  s4Freq?: number;
  /** B4 : amplitude relative. */
  s4Gain?: number;
  /** B4 : durée de décroissance (s). */
  s4Dur?: number;
  /** B4 : délai avant B1 (ms). */
  s4DelayMs?: number;
  /** Souffle : fréquence centrale du filtre passe-bande (Hz). */
  murmurFreq?: number;
  /** Souffle : résonance du passe-bande. */
  murmurQ?: number;
  /** Souffle : amplitude relative. */
  murmurGain?: number;
  /** Roulement diastolique (RM) : fréquence de coupure passe-bas (Hz). */
  rumbleFreq?: number;
  /** Roulement diastolique : amplitude relative. */
  rumbleGain?: number;
  /** Claquement d'ouverture mitrale : fréquence du clic (Hz). */
  osFreq?: number;
  /** Claquement d'ouverture mitrale : amplitude relative. */
  osGain?: number;
  /** Claquement d'ouverture mitrale : délai après B2 (ms). */
  osDelayMs?: number;
  /** Frottement péricardique : fréquence centrale du passe-bande (Hz). */
  rubFreq?: number;
  /** Frottement péricardique : amplitude relative. */
  rubGain?: number;
  /** Frottement péricardique : résonance du passe-bande. */
  rubQ?: number;
  /** FA : borne basse de la fréquence cardiaque irrégulière (battements/min). */
  bpmMin?: number;
  /** FA : borne haute de la fréquence cardiaque irrégulière (battements/min). */
  bpmMax?: number;
};

type ResolvedParams = Required<SoundParams>;

const DEFAULT_PARAMS: ResolvedParams = {
  bpm: 72,
  systoleMs: 340,
  diastoleMs: 480,
  s1Freq: 42,
  s2Freq: 60,
  s1Gain: 0.75,
  s2Gain: 0.6,
  s1Dur: 0.12,
  s2Dur: 0.09,
  filterFreq: 420,
  filterQ: 0.7,
  splitMs: 38,
  p2Freq: 68,
  s3Freq: 34,
  s3Gain: 0.36,
  s3Dur: 0.13,
  s3DelayMs: 140,
  s4Freq: 30,
  s4Gain: 0.32,
  s4Dur: 0.11,
  s4DelayMs: 82,
  murmurFreq: 420,
  murmurQ: 1.1,
  murmurGain: 0.2,
  rumbleFreq: 120,
  rumbleGain: 0.19,
  osFreq: 96,
  osGain: 0.42,
  osDelayMs: 72,
  rubFreq: 320,
  rubGain: 0.2,
  rubQ: 0.7,
  bpmMin: 100,
  bpmMax: 160,
};

/**
 * Paramètres de référence par preset. Les `params` passés à playSound()
 * surchargent le preset ; ceux de la fiche priment.
 */
const PRESETS: Record<string, Partial<SoundParams>> = {
  normal_s1s2: {
    bpm: 72,
    systoleMs: 340,
    diastoleMs: 480,
    s1Freq: 42,
    s2Freq: 60,
    s1Gain: 0.75,
    s2Gain: 0.6,
  },
  split_s2: {
    bpm: 72,
    systoleMs: 340,
    diastoleMs: 480,
    splitMs: 38,
    p2Freq: 68,
  },
  s3_gallop: {
    bpm: 84,
    systoleMs: 320,
    diastoleMs: 430,
    s3DelayMs: 140,
    s3Freq: 34,
    s3Gain: 0.36,
  },
  s4_gallop: {
    bpm: 84,
    systoleMs: 320,
    diastoleMs: 430,
    s4DelayMs: 82,
    s4Freq: 30,
    s4Gain: 0.32,
  },
  holosystolic_blowing: {
    bpm: 84,
    systoleMs: 340,
    diastoleMs: 400,
    murmurFreq: 430,
    murmurQ: 1.2,
    murmurGain: 0.2,
  },
  diastolic_rumble_os: {
    bpm: 76,
    systoleMs: 300,
    diastoleMs: 500,
    osDelayMs: 72,
    osFreq: 96,
    rumbleFreq: 120,
    rumbleGain: 0.19,
  },
  early_diastolic_decrescendo: {
    bpm: 80,
    systoleMs: 320,
    diastoleMs: 430,
    murmurFreq: 520,
    murmurQ: 0.9,
    murmurGain: 0.17,
  },
  ejection_crescendo_decrescendo: {
    bpm: 80,
    systoleMs: 360,
    diastoleMs: 390,
    murmurFreq: 380,
    murmurQ: 0.8,
    murmurGain: 0.24,
  },
  pericardial_rub: {
    bpm: 92,
    systoleMs: 320,
    diastoleMs: 340,
    rubFreq: 320,
    rubGain: 0.2,
    rubQ: 0.7,
  },
  irregular_fast: {
    bpm: 120,
    bpmMin: 100,
    bpmMax: 160,
    systoleMs: 300,
    diastoleMs: 260,
  },
};

/* ─── État module ────────────────────────────────────────────────────
   Un unique AudioContext, réutilisé entre les lectures (créé lazy). */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let voice: GainNode | null = null;
let schedulerId: ReturnType<typeof setInterval> | null = null;
let nextBeatTime = 0;
let activeParams: ResolvedParams | null = null;
/** Paramètres du preset pulmonaire en cours (étape 3/3). */
let activeLungParams: ResolvedLungParams | null = null;
/** Toutes les sources planifiées (oscillateurs + bruit) à couper par stop(). */
const liveSources = new Set<AudioScheduledSourceNode>();
/** Buffer de bruit blanc partagé (créé lazy, rejoué par tranches courtes). */
let noiseBuffer: AudioBuffer | null = null;

/** Le navigateur expose-t-il la Web Audio API ? */
export function isSupported(): boolean {
  if (typeof window === "undefined") return false;
  type W = typeof window & { webkitAudioContext?: typeof AudioContext };
  return Boolean(window.AudioContext ?? (window as W).webkitAudioContext);
}

/** AudioContext créé lazily ; renvoie null en SSR ou si l'API est absente. */
function ensureContext(): { ctx: AudioContext; master: GainNode } | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    type W = typeof window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (window as W).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 1.0;
    master.connect(ctx.destination);
  }
  if (!master) return null;
  if (ctx.state === "suspended") void ctx.resume();
  return { ctx, master };
}

function mergeParams(preset: string, params?: SoundParams): ResolvedParams {
  const out: ResolvedParams = { ...DEFAULT_PARAMS, ...(PRESETS[preset] ?? {}) };
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        (out as unknown as Record<string, number>)[key] = value;
      }
    }
  }
  return out;
}

/** Confort : millisecondes → secondes. */
const ms = (v: number): number => v / 1000;

/** Intervalle d'un battement (s) d'après bpm, borné à 30-200/min. */
function beatInterval(p: ResolvedParams): number {
  return 60 / Math.max(30, Math.min(200, p.bpm));
}

/* ─── Briques de synthèse ─────────────────────────────────────────── */

/** Mémorise une source planifiée pour la couper proprement dans stop(). */
function trackSource(node: AudioScheduledSourceNode): void {
  liveSources.add(node);
  node.onended = () => liveSources.delete(node);
}

/** Enveloppe d'un souffle selon sa morphologie temporelle. */
type NoiseShape = "plateau" | "diamond" | "decrescendo" | "crescendo";

function applyNoiseEnvelope(
  gain: AudioParam,
  at: number,
  dur: number,
  peak: number,
  shape: NoiseShape,
): void {
  const g = Math.max(0.0002, peak);
  const d = Math.max(0.03, dur);
  gain.cancelScheduledValues(at);
  gain.setValueAtTime(0.0001, at);
  if (shape === "crescendo") {
    gain.linearRampToValueAtTime(g, at + d);
    gain.linearRampToValueAtTime(0.0001, at + d + 0.02);
  } else if (shape === "decrescendo") {
    gain.linearRampToValueAtTime(g, at + 0.015);
    gain.exponentialRampToValueAtTime(0.0001, at + d);
  } else if (shape === "diamond") {
    gain.linearRampToValueAtTime(g, at + d * 0.45);
    gain.linearRampToValueAtTime(0.0001, at + d);
  } else {
    const attack = Math.min(0.03, d * 0.2);
    const release = Math.min(0.05, d * 0.3);
    gain.linearRampToValueAtTime(g, at + attack);
    gain.setValueAtTime(g, at + d - release);
    gain.linearRampToValueAtTime(0.0001, at + d);
  }
}

/** Filtre + enveloppe + oscillateurs : un « clic » de valve / un claquement. */
function thump(
  audio: AudioContext,
  destination: AudioNode,
  at: number,
  o: { freq: number; gain: number; dur: number; filterFreq: number; filterQ: number },
): void {
  const t = Math.max(0, at);
  const osc = audio.createOscillator();
  const partial = audio.createOscillator();
  const partialGain = audio.createGain();
  const env = audio.createGain();
  const filter = audio.createBiquadFilter();

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(o.filterFreq, t);
  filter.Q.setValueAtTime(o.filterQ, t);

  osc.type = "sine";
  osc.frequency.setValueAtTime(o.freq, t);
  partial.type = "triangle";
  partial.frequency.setValueAtTime(o.freq * 2.6, t);
  partialGain.gain.setValueAtTime(0.7, t);

  // Enveloppe percussive : attaque quasi instantanée, décroissance rapide.
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), t + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);

  osc.connect(env);
  partial.connect(partialGain).connect(env);
  env.connect(filter).connect(destination);

  for (const node of [osc, partial]) {
    trackSource(node);
    node.start(t);
    node.stop(t + o.dur + 0.06);
  }
}

/** Raccourci : un clic valvulaire typé (B1, B2, P2, B3, B4, COM). */
function click(
  audio: AudioContext,
  destination: AudioNode,
  at: number,
  freq: number,
  gain: number,
  dur: number,
  p: ResolvedParams,
  filterFreq: number = p.filterFreq,
  filterQ: number = p.filterQ,
): void {
  thump(audio, destination, at, { freq, gain, dur, filterFreq, filterQ });
}

/** Bruit blanc filtré + enveloppe : souffles, roulements, frottements. */
function noise(
  audio: AudioContext,
  destination: AudioNode,
  at: number,
  o: {
    dur: number;
    gain: number;
    filter: BiquadFilterType;
    freq: number;
    q: number;
    shape: NoiseShape;
  },
): void {
  const t = Math.max(0, at);
  const src = audio.createBufferSource();
  src.buffer = getNoiseBuffer(audio);
  src.loop = true;

  const filter = audio.createBiquadFilter();
  filter.type = o.filter;
  filter.frequency.setValueAtTime(o.freq, t);
  filter.Q.setValueAtTime(o.q, t);

  const env = audio.createGain();
  applyNoiseEnvelope(env.gain, t, o.dur, o.gain, o.shape);

  src.connect(filter);
  filter.connect(env);
  env.connect(destination);

  trackSource(src);
  src.start(t);
  src.stop(t + o.dur + 0.06);
}

/** Buffer de bruit blanc (2 s) partagé par toutes les sources de bruit. */
function getNoiseBuffer(audio: AudioContext): AudioBuffer {
  if (!noiseBuffer || noiseBuffer.sampleRate !== audio.sampleRate) {
    const length = Math.floor(audio.sampleRate * 2);
    noiseBuffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

/* ─── Construction d'un cycle cardiaque par preset ────────────────────
   Chaque fonction planifie les composantes d'UN cycle au temps `at` et
   renvoie l'intervalle (s) avant le cycle suivant : c'est la seule partie
   qui varie d'un preset à l'autre. */

type BeatScheduler = (
  audio: AudioContext,
  destination: AudioNode,
  at: number,
  p: ResolvedParams,
) => number;

/** B1 puis B2 (bruits normaux). */
function beatNormal(a: AudioContext, d: AudioNode, at: number, p: ResolvedParams): number {
  click(a, d, at, p.s1Freq, p.s1Gain, p.s1Dur, p);
  click(a, d, at + ms(p.systoleMs), p.s2Freq, p.s2Gain, p.s2Dur, p);
  return beatInterval(p);
}

const PRESET_BEATS: Record<string, BeatScheduler> = {
  normal_s1s2: beatNormal,

  // Dédoublement de B2 : B2 scindé en A2 + P2 rapprochés (~35-40 ms).
  split_s2: (a, d, at, p) => {
    click(a, d, at, p.s1Freq, p.s1Gain, p.s1Dur, p);
    const s2 = at + ms(p.systoleMs);
    click(a, d, s2, p.s2Freq, p.s2Gain, p.s2Dur, p);
    click(a, d, s2 + ms(p.splitMs), p.p2Freq, p.s2Gain * 0.8, p.s2Dur, p);
    return beatInterval(p);
  },

  // B3 : troisième bruit sourd ~140 ms après B2 (remplissage ventriculaire).
  s3_gallop: (a, d, at, p) => {
    click(a, d, at, p.s1Freq, p.s1Gain, p.s1Dur, p);
    const s2 = at + ms(p.systoleMs);
    click(a, d, s2, p.s2Freq, p.s2Gain, p.s2Dur, p);
    click(a, d, s2 + ms(p.s3DelayMs), p.s3Freq, p.s3Gain, p.s3Dur, p, 260, 0.8);
    return beatInterval(p);
  },

  // B4 : quatrième bruit sourd ~80 ms avant B1 (systole auriculaire).
  s4_gallop: (a, d, at, p) => {
    const s4 = at - ms(p.s4DelayMs);
    if (s4 >= 0) click(a, d, s4, p.s4Freq, p.s4Gain, p.s4Dur, p, 260, 0.8);
    click(a, d, at, p.s1Freq, p.s1Gain, p.s1Dur, p);
    click(a, d, at + ms(p.systoleMs), p.s2Freq, p.s2Gain, p.s2Dur, p);
    return beatInterval(p);
  },

  // Insuffisance mitrale : souffle holosystolique « en jet de vapeur ».
  holosystolic_blowing: (a, d, at, p) => {
    click(a, d, at, p.s1Freq, p.s1Gain, p.s1Dur, p);
    const sys = ms(p.systoleMs);
    noise(a, d, at + 0.02, {
      dur: Math.max(0.06, sys - 0.05),
      gain: p.murmurGain,
      filter: "bandpass",
      freq: p.murmurFreq,
      q: p.murmurQ,
      shape: "plateau",
    });
    click(a, d, at + sys, p.s2Freq, p.s2Gain, p.s2Dur, p);
    return beatInterval(p);
  },

  // Rétrécissement mitral : B1 éclatant + B2 + claquement d'ouverture + roulement.
  diastolic_rumble_os: (a, d, at, p) => {
    click(a, d, at, p.s1Freq, p.s1Gain, p.s1Dur, p);
    const sys = ms(p.systoleMs);
    click(a, d, at + sys, p.s2Freq, p.s2Gain, p.s2Dur, p);
    const os = at + sys + ms(p.osDelayMs);
    click(a, d, os, p.osFreq, p.osGain, 0.05, p, 1400, 1.0);
    const interval = beatInterval(p);
    const rumbleStart = os + 0.04;
    const rumbleDur = Math.max(0.1, at + interval - 0.02 - rumbleStart);
    noise(a, d, rumbleStart, {
      dur: rumbleDur,
      gain: p.rumbleGain,
      filter: "lowpass",
      freq: p.rumbleFreq,
      q: 0.9,
      shape: "crescendo",
    });
    return interval;
  },

  // Insuffisance aortique : souffle protodiastolique decrescendo « humé ».
  early_diastolic_decrescendo: (a, d, at, p) => {
    click(a, d, at, p.s1Freq, p.s1Gain, p.s1Dur, p);
    const s2 = at + ms(p.systoleMs);
    click(a, d, s2, p.s2Freq, p.s2Gain, p.s2Dur, p);
    noise(a, d, s2 + 0.015, {
      dur: 0.24,
      gain: p.murmurGain,
      filter: "bandpass",
      freq: p.murmurFreq,
      q: p.murmurQ,
      shape: "decrescendo",
    });
    return beatInterval(p);
  },

  // Rétrécissement aortique : souffle d'éjection crescendo-decrescendo « losange ».
  ejection_crescendo_decrescendo: (a, d, at, p) => {
    click(a, d, at, p.s1Freq, p.s1Gain, p.s1Dur, p);
    const sys = ms(p.systoleMs);
    noise(a, d, at + 0.03, {
      dur: Math.max(0.1, sys - 0.07),
      gain: p.murmurGain,
      filter: "bandpass",
      freq: p.murmurFreq,
      q: p.murmurQ,
      shape: "diamond",
    });
    click(a, d, at + sys, p.s2Freq, p.s2Gain, p.s2Dur, p);
    return beatInterval(p);
  },

  // Frottement péricardique : deux frottements râpeux systolo-diastoliques.
  pericardial_rub: (a, d, at, p) => {
    const sys = ms(p.systoleMs);
    noise(a, d, at + 0.02, {
      dur: 0.13,
      gain: p.rubGain,
      filter: "bandpass",
      freq: p.rubFreq,
      q: p.rubQ,
      shape: "plateau",
    });
    noise(a, d, at + sys + 0.02, {
      dur: 0.14,
      gain: p.rubGain * 0.9,
      filter: "bandpass",
      freq: p.rubFreq * 0.85,
      q: p.rubQ,
      shape: "diamond",
    });
    return beatInterval(p);
  },

  // Fibrillation atriale : B1/B2 à intervalles irréguliers, B1 d'intensité variable.
  irregular_fast: (a, d, at, p) => {
    const bpm = p.bpmMin + Math.random() * Math.max(0, p.bpmMax - p.bpmMin);
    const s1Gain = p.s1Gain * (0.6 + Math.random() * 0.6);
    const s2Gain = p.s2Gain * (0.8 + Math.random() * 0.4);
    click(a, d, at, p.s1Freq, s1Gain, p.s1Dur, p);
    click(a, d, at + ms(p.systoleMs), p.s2Freq, s2Gain, p.s2Dur, p);
    return 60 / Math.max(30, Math.min(200, bpm));
  },
};

/**
 * Joue un son synthétisé, en boucle, jusqu'à stop().
 * Le premier appel crée l'AudioContext (geste utilisateur requis).
 */
export function playSound(preset: string, params: SoundParams = {}): void {
  const audio = ensureContext();
  if (!audio) return;
  const { ctx: ac, master: masterGain } = audio;

  // Toute lecture précédente est coupée proprement.
  stop();

  const p = mergeParams(preset, params);
  const builder = PRESET_BEATS[preset] ?? beatNormal;

  voice = ac.createGain();
  voice.gain.setValueAtTime(1, ac.currentTime);
  voice.connect(masterGain);

  nextBeatTime = ac.currentTime + 0.08;

  const scheduler = () => {
    if (!voice || !activeParams) return;
    const horizon = ac.currentTime + 0.8;
    let guard = 0;
    while (nextBeatTime < horizon && guard < 128) {
      const interval = builder(ac, voice, nextBeatTime, activeParams);
      nextBeatTime += Math.max(0.2, interval);
      guard += 1;
    }
  };

  activeParams = p;
  scheduler();
  schedulerId = setInterval(scheduler, 120);
}

/** Coupe le son en cours : fondu court puis arrêt des sources. */
export function stop(): void {
  if (schedulerId !== null) {
    clearInterval(schedulerId);
    schedulerId = null;
  }
  activeParams = null;
  activeLungParams = null;

  const ac = ctx;
  const v = voice;

  if (ac && v) {
    const now = ac.currentTime;
    try {
      v.gain.cancelScheduledValues(now);
      v.gain.setValueAtTime(v.gain.value, now);
      v.gain.linearRampToValueAtTime(0.0001, now + 0.05);
    } catch {
      /* le nœud peut déjà être déconnecté */
    }
  }

  // Laisse le fondu se jouer avant de couper réellement les sources.
  const stopAt = (ac?.currentTime ?? 0) + 0.12;
  for (const node of liveSources) {
    try {
      node.stop(stopAt);
    } catch {
      /* déjà arrêtée */
    }
  }
  liveSources.clear();

  if (ac && v) {
    setTimeout(() => {
      try {
        v.disconnect();
      } catch {
        /* déjà déconnecté */
      }
      if (voice === v) voice = null;
    }, 140);
  } else {
    voice = null;
  }
}

/** Un son est-il actuellement programmé ? */
export function isPlaying(): boolean {
  return schedulerId !== null;
}

/** État brut du contexte audio (diagnostic / QA). Null si non créé. */
export function audioContextState(): AudioContextState | null {
  return ctx?.state ?? null;
}

/* ═══════════════════════════════════════════════════════════════════
   Moteur pulmonaire — étape 3/3
   ───────────────────────────────────────────────────────────────────
   Même principe que le moteur cardiaque : chaque preset planifie UN cycle
   respiratoire (inspiration + expiration) et renvoie sa durée. Les bruits
   continus utilisent `noise()` (bruit blanc filtré) ; les craquements, des
   bouffées courtes de bruit (`crackleBurst`) ; les sibilances, un bruit
   passe-bande modulé en amplitude par un oscillateur local (`wheeze`).

   Nomenclature clinique (Adnet/Lapostolle) : « craquements » de basse /
   moyenne / haute fréquence — jamais « crépitants ». Craquements
   bronchiques (proximaux, mobilisables par la toux) versus craquements
   pleuraux (miroirs inspiration/expiration).
   ═══════════════════════════════════════════════════════════════════ */

export type LungParams = {
  /** Fréquence respiratoire (cycles / minute). Pilote la durée du cycle. */
  breathsPerMin?: number;
  /** Inspiratoire occupant le cycle (ms) — fixe le rapport I/E avec expirationMs. */
  inspirationMs?: number;
  /** Durée expiratoire (ms). */
  expirationMs?: number;
  /** Fréquence centrale / coupure du bruit de fond respiratoire (Hz). */
  ambientFreq?: number;
  /** Résonance du filtre de fond. */
  ambientQ?: number;
  /** Amplitude relative du bruit de fond. */
  ambientGain?: number;
  /** Craquements : fréquence centrale du passe-bande (Hz). */
  crackleFreq?: number;
  /** Craquements : résonance du filtre. */
  crackleQ?: number;
  /** Craquements : durée d'une bouffée (ms). */
  crackleDurMs?: number;
  /** Craquements : amplitude relative. */
  crackleGain?: number;
  /** Craquements : nombre de bouffées par cycle. */
  crackleCount?: number;
  /** Sibilances : fréquence centrale du passe-bande (Hz). */
  wheezeFreq?: number;
  /** Sibilances : résonance (forte = caractère musical). */
  wheezeQ?: number;
  /** Sibilances : amplitude relative. */
  wheezeGain?: number;
  /** Sibilances : fréquence de modulation d'amplitude (Hz). */
  wheezeModHz?: number;
  /** Stridor : fréquence centrale du passe-bande (Hz). */
  stridorFreq?: number;
  /** Stridor : résonance du filtre. */
  stridorQ?: number;
  /** Stridor : amplitude relative. */
  stridorGain?: number;
};

export type ResolvedLungParams = Required<LungParams>;

const DEFAULT_LUNG_PARAMS: ResolvedLungParams = {
  breathsPerMin: 16,
  inspirationMs: 1400,
  expirationMs: 2200,
  ambientFreq: 500,
  ambientQ: 0.7,
  ambientGain: 0.12,
  crackleFreq: 600,
  crackleQ: 1.4,
  crackleDurMs: 15,
  crackleGain: 0.45,
  crackleCount: 6,
  wheezeFreq: 600,
  wheezeQ: 6,
  wheezeGain: 0.16,
  wheezeModHz: 3,
  stridorFreq: 1200,
  stridorQ: 4,
  stridorGain: 0.2,
};

/** Réglages de référence par preset pulmonaire (surchargés par la fiche). */
const LUNG_PRESETS: Record<string, Partial<LungParams>> = {
  normal_vesicular: {
    breathsPerMin: 16,
    ambientFreq: 500,
    ambientQ: 0.7,
    ambientGain: 0.14,
  },
  normal_tracheal: {
    breathsPerMin: 16,
    ambientFreq: 800,
    ambientQ: 0.9,
    ambientGain: 0.13,
  },
  fine_crackles: {
    breathsPerMin: 18,
    ambientFreq: 480,
    ambientGain: 0.05,
    crackleFreq: 900,
    crackleQ: 1.6,
    crackleDurMs: 8,
    crackleGain: 0.5,
    crackleCount: 8,
  },
  medium_crackles: {
    breathsPerMin: 18,
    ambientFreq: 480,
    ambientGain: 0.05,
    crackleFreq: 600,
    crackleQ: 1.4,
    crackleDurMs: 15,
    crackleGain: 0.45,
    crackleCount: 6,
  },
  coarse_crackles: {
    breathsPerMin: 16,
    ambientFreq: 420,
    ambientGain: 0.05,
    crackleFreq: 300,
    crackleQ: 1.1,
    crackleDurMs: 25,
    crackleGain: 0.45,
    crackleCount: 5,
  },
  pleural_crackles: {
    breathsPerMin: 16,
    ambientFreq: 460,
    ambientGain: 0.04,
    crackleFreq: 520,
    crackleQ: 1.3,
    crackleDurMs: 12,
    crackleGain: 0.4,
    crackleCount: 2,
  },
  sibilances: {
    breathsPerMin: 20,
    ambientFreq: 420,
    ambientGain: 0.05,
    wheezeFreq: 600,
    wheezeQ: 6,
    wheezeGain: 0.16,
    wheezeModHz: 3,
  },
  stridor: {
    breathsPerMin: 22,
    inspirationMs: 1600,
    expirationMs: 1400,
    ambientFreq: 380,
    ambientGain: 0.03,
    stridorFreq: 1200,
    stridorQ: 4,
    stridorGain: 0.2,
  },
  bronchial_breath: {
    breathsPerMin: 16,
    ambientFreq: 500,
    ambientQ: 0.9,
    ambientGain: 0.2,
  },
  pleural_effusion_souffle: {
    breathsPerMin: 16,
    ambientFreq: 430,
    ambientQ: 0.8,
    ambientGain: 0.17,
  },
};

function mergeLungParams(preset: string, params?: LungParams): ResolvedLungParams {
  const out: ResolvedLungParams = {
    ...DEFAULT_LUNG_PARAMS,
    ...(LUNG_PRESETS[preset] ?? {}),
  };
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        (out as unknown as Record<string, number>)[key] = value;
      }
    }
  }
  return out;
}

/** Durées d'inspiration et d'expiration (s) déduites du cycle respiratoire. */
function lungTiming(p: ResolvedLungParams): { insp: number; expi: number; total: number } {
  const total = 60 / Math.max(6, Math.min(60, p.breathsPerMin));
  const ratio = p.inspirationMs / Math.max(1, p.inspirationMs + p.expirationMs);
  const insp = Math.max(0.3, total * ratio);
  const expi = Math.max(0.3, total - insp);
  return { insp, expi, total: insp + expi };
}

/** Bouffée de craquement : bruit blanc filtré en passe-bande, enveloppe très brève. */
function crackleBurst(
  audio: AudioContext,
  destination: AudioNode,
  at: number,
  o: { durMs: number; freq: number; q: number; gain: number },
): void {
  const t = Math.max(0, at);
  const dur = Math.max(0.004, ms(o.durMs));
  const src = audio.createBufferSource();
  src.buffer = getNoiseBuffer(audio);
  src.loop = true;

  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(o.freq, t);
  filter.Q.setValueAtTime(o.q, t);

  const env = audio.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), t + dur * 0.3);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  src.connect(filter);
  filter.connect(env);
  env.connect(destination);

  trackSource(src);
  src.start(t);
  src.stop(t + dur + 0.02);
}

/** Sibilance : bruit passe-bande continu modulé en amplitude (caractère musical). */
function wheeze(
  audio: AudioContext,
  destination: AudioNode,
  at: number,
  dur: number,
  p: ResolvedLungParams,
): void {
  const t = Math.max(0, at);
  const d = Math.max(0.1, dur);
  const src = audio.createBufferSource();
  src.buffer = getNoiseBuffer(audio);
  src.loop = true;

  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(p.wheezeFreq, t);
  filter.Q.setValueAtTime(p.wheezeQ, t);

  const env = audio.createGain();
  const g = Math.max(0.0002, p.wheezeGain);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(g * 0.6, t + Math.min(0.25, d * 0.3));
  env.gain.setValueAtTime(g * 0.6, t + Math.max(0.3, d - 0.2));
  env.gain.linearRampToValueAtTime(0.0001, t + d);

  // Modulation d'amplitude : un oscillateur lent ajoute ±(g/2) à l'enveloppe.
  const lfo = audio.createOscillator();
  lfo.type = "sine";
  lfo.frequency.setValueAtTime(p.wheezeModHz, t);
  const lfoGain = audio.createGain();
  lfoGain.gain.setValueAtTime(g * 0.5, t);
  lfo.connect(lfoGain);
  lfoGain.connect(env.gain);

  src.connect(filter);
  filter.connect(env);
  env.connect(destination);

  for (const node of [src, lfo]) {
    trackSource(node);
    node.start(t);
    node.stop(t + d + 0.06);
  }
}

/** Craquements répartis aléatoirement dans une portion [from, to] du cycle. */
function scatterCrackles(
  audio: AudioContext,
  destination: AudioNode,
  at: number,
  window: number,
  from: number,
  to: number,
  p: ResolvedLungParams,
): void {
  const count = Math.max(1, Math.round(p.crackleCount));
  for (let i = 0; i < count; i += 1) {
    const frac = from + Math.random() * Math.max(0, to - from);
    const jitterGain = p.crackleGain * (0.6 + Math.random() * 0.5);
    crackleBurst(audio, destination, at + window * frac, {
      durMs: p.crackleDurMs,
      freq: p.crackleFreq,
      q: p.crackleQ,
      gain: jitterGain,
    });
  }
}

/* ─── Un cycle respiratoire par preset pulmonaire ────────────────────
   Chaque fonction planifie l'inspiration et l'expiration au temps `at` et
   renvoie la durée du cycle complet (s) avant le cycle suivant. */

type BreathScheduler = (
  audio: AudioContext,
  destination: AudioNode,
  at: number,
  p: ResolvedLungParams,
) => number;

/** Murmure vésiculaire : souffle doux continu, plus fort à l'inspiration. */
function breathVesicular(a: AudioContext, d: AudioNode, at: number, p: ResolvedLungParams): number {
  const { insp, expi, total } = lungTiming(p);
  noise(a, d, at, {
    dur: insp,
    gain: p.ambientGain,
    filter: "lowpass",
    freq: p.ambientFreq,
    q: p.ambientQ,
    shape: "plateau",
  });
  noise(a, d, at + insp, {
    dur: expi,
    gain: p.ambientGain * 0.55,
    filter: "lowpass",
    freq: p.ambientFreq * 0.9,
    q: p.ambientQ,
    shape: "decrescendo",
  });
  return total;
}

/** Bruit trachéal : souffle passe-bande rude, d'intensité équivalente dans les deux phases. */
function breathTracheal(a: AudioContext, d: AudioNode, at: number, p: ResolvedLungParams): number {
  const { insp, expi, total } = lungTiming(p);
  noise(a, d, at, {
    dur: insp,
    gain: p.ambientGain,
    filter: "bandpass",
    freq: p.ambientFreq,
    q: p.ambientQ,
    shape: "plateau",
  });
  noise(a, d, at + insp, {
    dur: expi,
    gain: p.ambientGain * 0.8,
    filter: "bandpass",
    freq: p.ambientFreq,
    q: p.ambientQ,
    shape: "plateau",
  });
  return total;
}

/** Craquements de HAUTE fréquence : fins, télé-inspiratoires (fin d'inspiration). */
function breathFineCrackles(a: AudioContext, d: AudioNode, at: number, p: ResolvedLungParams): number {
  const { insp, total } = lungTiming(p);
  noise(a, d, at, {
    dur: total,
    gain: p.ambientGain * 0.6,
    filter: "lowpass",
    freq: p.ambientFreq,
    q: p.ambientQ,
    shape: "plateau",
  });
  scatterCrackles(a, d, at, insp, 0.6, 1, p);
  return total;
}

/** Craquements de MOYENNE fréquence : holo-inspiratoires (bronches segmentaires). */
function breathMediumCrackles(
  a: AudioContext,
  d: AudioNode,
  at: number,
  p: ResolvedLungParams,
): number {
  const { insp, total } = lungTiming(p);
  noise(a, d, at, {
    dur: total,
    gain: p.ambientGain * 0.6,
    filter: "lowpass",
    freq: p.ambientFreq,
    q: p.ambientQ,
    shape: "plateau",
  });
  scatterCrackles(a, d, at, insp, 0.05, 1, p);
  return total;
}

/** Craquements de BASSE fréquence : grossiers, proximaux, tout au long du cycle. */
function breathCoarseCrackles(
  a: AudioContext,
  d: AudioNode,
  at: number,
  p: ResolvedLungParams,
): number {
  const { total } = lungTiming(p);
  noise(a, d, at, {
    dur: total,
    gain: p.ambientGain * 0.6,
    filter: "lowpass",
    freq: p.ambientFreq,
    q: p.ambientQ,
    shape: "plateau",
  });
  scatterCrackles(a, d, at, total, 0, 1, p);
  return total;
}

/** Craquements PLEURAUX : deux bouffées miroirs, fin d'inspiration et fin d'expiration. */
function breathPleuralCrackles(
  a: AudioContext,
  d: AudioNode,
  at: number,
  p: ResolvedLungParams,
): number {
  const { insp, expi, total } = lungTiming(p);
  noise(a, d, at, {
    dur: total,
    gain: p.ambientGain * 0.5,
    filter: "lowpass",
    freq: p.ambientFreq,
    q: p.ambientQ,
    shape: "plateau",
  });
  crackleBurst(a, d, at + insp * 0.9, {
    durMs: p.crackleDurMs,
    freq: p.crackleFreq,
    q: p.crackleQ,
    gain: p.crackleGain,
  });
  crackleBurst(a, d, at + insp + expi * 0.9, {
    durMs: p.crackleDurMs,
    freq: p.crackleFreq * 0.9,
    q: p.crackleQ,
    gain: p.crackleGain * 0.9,
  });
  return total;
}

/** Sibilances : sifflement continu méso/télé-expiratoire, sur fond vésiculaire. */
function breathSibilances(a: AudioContext, d: AudioNode, at: number, p: ResolvedLungParams): number {
  const { insp, expi, total } = lungTiming(p);
  noise(a, d, at, {
    dur: insp,
    gain: p.ambientGain * 0.5,
    filter: "lowpass",
    freq: p.ambientFreq,
    q: p.ambientQ,
    shape: "plateau",
  });
  wheeze(a, d, at + insp + expi * 0.12, expi * 0.88, p);
  return total;
}

/** Stridor : sifflement rude inspiratoire (obstruction extra-thoracique). */
function breathStridor(a: AudioContext, d: AudioNode, at: number, p: ResolvedLungParams): number {
  const { insp, expi, total } = lungTiming(p);
  noise(a, d, at, {
    dur: insp * 0.95,
    gain: p.stridorGain,
    filter: "bandpass",
    freq: p.stridorFreq,
    q: p.stridorQ,
    shape: "diamond",
  });
  noise(a, d, at + insp, {
    dur: expi,
    gain: p.ambientGain * 0.4,
    filter: "lowpass",
    freq: p.ambientFreq,
    q: p.ambientQ,
    shape: "decrescendo",
  });
  return total;
}

/** Souffle bronchique : bruit passe-bande continu rude, plus fort à l'inspiration. */
function breathBronchial(a: AudioContext, d: AudioNode, at: number, p: ResolvedLungParams): number {
  const { insp, expi, total } = lungTiming(p);
  noise(a, d, at, {
    dur: insp,
    gain: p.ambientGain,
    filter: "bandpass",
    freq: p.ambientFreq,
    q: p.ambientQ,
    shape: "plateau",
  });
  noise(a, d, at + insp, {
    dur: expi,
    gain: p.ambientGain * 0.8,
    filter: "bandpass",
    freq: p.ambientFreq,
    q: p.ambientQ,
    shape: "plateau",
  });
  return total;
}

/** Souffle pleurétique : souffle aspiratif prédominant à l'inspiration, prolongé à l'expiration. */
function breathPleuralEffusion(
  a: AudioContext,
  d: AudioNode,
  at: number,
  p: ResolvedLungParams,
): number {
  const { insp, expi, total } = lungTiming(p);
  noise(a, d, at, {
    dur: insp,
    gain: p.ambientGain * 1.1,
    filter: "bandpass",
    freq: p.ambientFreq,
    q: p.ambientQ,
    shape: "plateau",
  });
  noise(a, d, at + insp, {
    dur: expi * 0.75,
    gain: p.ambientGain * 0.8,
    filter: "bandpass",
    freq: p.ambientFreq * 0.85,
    q: p.ambientQ,
    shape: "decrescendo",
  });
  return total;
}

const PRESET_BREATHS: Record<string, BreathScheduler> = {
  normal_vesicular: breathVesicular,
  normal_tracheal: breathTracheal,
  fine_crackles: breathFineCrackles,
  medium_crackles: breathMediumCrackles,
  coarse_crackles: breathCoarseCrackles,
  pleural_crackles: breathPleuralCrackles,
  sibilances: breathSibilances,
  stridor: breathStridor,
  bronchial_breath: breathBronchial,
  pleural_effusion_souffle: breathPleuralEffusion,
};

/**
 * Joue un son pulmonaire synthétisé, en boucle, jusqu'à stop().
 * Le premier appel crée l'AudioContext (geste utilisateur requis).
 */
export function playLungSound(preset: string, params: LungParams = {}): void {
  const audio = ensureContext();
  if (!audio) return;
  const { ctx: ac, master: masterGain } = audio;

  // Toute lecture précédente est coupée proprement.
  stop();

  const p = mergeLungParams(preset, params);
  const builder = PRESET_BREATHS[preset] ?? breathVesicular;

  voice = ac.createGain();
  voice.gain.setValueAtTime(1, ac.currentTime);
  voice.connect(masterGain);

  nextBeatTime = ac.currentTime + 0.1;

  const scheduler = () => {
    if (!voice || !activeLungParams) return;
    // Les cycles respiratoires sont longs : horizon étendu.
    const horizon = ac.currentTime + 3;
    let guard = 0;
    while (nextBeatTime < horizon && guard < 32) {
      const interval = builder(ac, voice, nextBeatTime, activeLungParams);
      nextBeatTime += Math.max(0.8, interval);
      guard += 1;
    }
  };

  activeLungParams = p;
  scheduler();
  schedulerId = setInterval(scheduler, 250);
}

/** Presets réellement implémentés (garde-fou de cohérence des fiches). */
export function listPresets(): string[] {
  return [...Object.keys(PRESET_BEATS), ...Object.keys(PRESET_BREATHS)];
}

/** Presets pulmonaires réellement implémentés. */
export function listLungPresets(): string[] {
  return Object.keys(PRESET_BREATHS);
}
