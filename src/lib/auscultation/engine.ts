/* ═══════════════════════════════════════════════════════════════════
   Moteur audio — Auscultation
   ───────────────────────────────────────────────────────────────────
   Synthèse des bruits du cœur (et, à terme, des sons pulmonaires) sans
   aucun fichier audio embarqué : OscillatorNode + GainNode +
   BiquadFilterNode.

   Contrainte navigateur : un AudioContext ne démarre qu'après un geste
   utilisateur → il est créé LAZILY au premier appel de playSound().

   v1 : un seul preset, "normal_s1s2" (B1 puis B2, silence, en boucle
   continue jusqu'à stop()).

   Utilisation :
     playSound("normal_s1s2", { bpm: 72, s1Freq: 42 });
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
};

/**
 * Presets v1 et leurs réglages de référence. Les `params` passés à
 * playSound() surchargent le preset ; ceux de la fiche priment.
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
};

/* ─── État module ────────────────────────────────────────────────────
   Un unique AudioContext, réutilisé entre les lectures (créé lazy). */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let voice: GainNode | null = null;
let schedulerId: ReturnType<typeof setInterval> | null = null;
let nextBeatTime = 0;
let activeParams: ResolvedParams | null = null;
const liveOscillators = new Set<OscillatorNode>();

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

/** Filtre + enveloppe + oscillateurs : un « clic » de valve. */
function thump(
  audio: AudioContext,
  destination: AudioNode,
  at: number,
  o: { freq: number; gain: number; dur: number; filterFreq: number; filterQ: number },
): void {
  const osc = audio.createOscillator();
  const partial = audio.createOscillator();
  const partialGain = audio.createGain();
  const env = audio.createGain();
  const filter = audio.createBiquadFilter();

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(o.filterFreq, at);
  filter.Q.setValueAtTime(o.filterQ, at);

  osc.type = "sine";
  osc.frequency.setValueAtTime(o.freq, at);
  partial.type = "triangle";
  partial.frequency.setValueAtTime(o.freq * 2.6, at);
  partialGain.gain.setValueAtTime(0.7, at);

  // Enveloppe percussive : attaque quasi instantanée, décroissance rapide.
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), at + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);

  osc.connect(env);
  partial.connect(partialGain).connect(env);
  env.connect(filter).connect(destination);

  for (const node of [osc, partial]) {
    liveOscillators.add(node);
    node.onended = () => liveOscillators.delete(node);
    node.start(at);
    node.stop(at + o.dur + 0.06);
  }
}

function scheduleBeat(
  audio: AudioContext,
  destination: AudioNode,
  at: number,
  p: ResolvedParams,
): void {
  thump(audio, destination, at, {
    freq: p.s1Freq,
    gain: p.s1Gain,
    dur: p.s1Dur,
    filterFreq: p.filterFreq,
    filterQ: p.filterQ,
  });
  thump(audio, destination, at + p.systoleMs / 1000, {
    freq: p.s2Freq,
    gain: p.s2Gain,
    dur: p.s2Dur,
    filterFreq: p.filterFreq,
    filterQ: p.filterQ,
  });
}

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

  voice = ac.createGain();
  voice.gain.setValueAtTime(1, ac.currentTime);
  voice.connect(masterGain);

  nextBeatTime = ac.currentTime + 0.08;

  const scheduler = () => {
    if (!voice || !activeParams) return;
    const horizon = ac.currentTime + 0.6;
    while (nextBeatTime < horizon) {
      scheduleBeat(ac, voice, nextBeatTime, activeParams);
      nextBeatTime += 60 / Math.max(30, Math.min(200, activeParams.bpm));
    }
  };

  activeParams = p;
  scheduler();
  schedulerId = setInterval(scheduler, 120);
}

/** Coupe le son en cours : fondu court puis arrêt des oscillateurs. */
export function stop(): void {
  if (schedulerId !== null) {
    clearInterval(schedulerId);
    schedulerId = null;
  }
  activeParams = null;

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

  // Laisse le fondu se jouer avant de couper réellement les oscillateurs.
  const stopAt = (ac?.currentTime ?? 0) + 0.12;
  for (const osc of liveOscillators) {
    try {
      osc.stop(stopAt);
    } catch {
      /* déjà arrêté */
    }
  }
  liveOscillators.clear();

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
