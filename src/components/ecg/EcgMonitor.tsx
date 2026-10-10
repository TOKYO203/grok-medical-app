import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2 } from "lucide-react";
import { useEcgBeep } from "@/lib/ecg/useEcgBeep";
import type { SoundType } from "@/lib/ecg/sounds";
import type { EcgDeformation } from "@/lib/ecg/deformation";
import { cyclePathMm } from "@/lib/ecg/waveform";
import {
  ECG_GAIN_REDUCED,
  ECG_GAIN_STEPS,
  ECG_NORMS,
  ECG_SWEEP_SECONDS,
  type EcgGain,
} from "@/core/ecg";

/* ═══════════════════════════════════════════════════════════════════════
   Moniteur ECG 12 dérivations — « viewBox natif » en millimètres
   ───────────────────────────────────────────────────────────────────────
   1 unité de viewBox = 1 mm de papier : 25 mm/s en abscisse, N mm/mV en
   ordonnée (N = gain courant). La grille est donc un vrai quadrillage
   1 mm / 5 mm.

   Un SEUL cycle cardiaque est généré par dérivation, puis répété via des
   `<use>` décalés d'une largeur de cycle (périodicité du rythme) ; le
   défilement n'est qu'un `translate` de groupe, appliqué hors React
   (aucun re-render par frame). Les dérivations frontales sont dérivées de
   DI et DII par la loi d'Einthoven (cf. waveform.ts).

   Convention QA : attributs `data-ecg-*` sur le DOM (cf. README.md).
   ═══════════════════════════════════════════════════════════════════════ */

const MM_PER_SEC = ECG_NORMS.paperSpeedMmPerSec; // 25 mm/s
const SWEEP = ECG_SWEEP_SECONDS; // 4 s visibles
const TRACE_MM = SWEEP * MM_PER_SEC; // 100 mm de tracé par colonne

const LEFT_LEADS = ["I", "II", "III", "aVR", "aVL", "aVF", "PLETH"] as const;
const RIGHT_LEADS = ["V1", "V2", "V3", "V4", "V5", "V6"] as const;
const ALL_LEADS: readonly string[] = [...LEFT_LEADS, ...RIGHT_LEADS];

// Mise en page « papier » (mm).
const PAD_X = 4;
const PAD_TOP = 10;
const PAD_BOTTOM = 4;
const LABEL_MM = 11;
const COL_W = LABEL_MM + TRACE_MM;
const COL_GAP = 6;
const PANEL_W = 54;
const INNER_H = 126;
const VIEW_W = PAD_X * 2 + COL_W * 2 + COL_GAP * 2 + PANEL_W; // 296 mm
const VIEW_H = PAD_TOP + INNER_H + PAD_BOTTOM; // 140 mm
const COL_L = PAD_X;
const TRACE_L = COL_L + LABEL_MM;
const COL_R = PAD_X + COL_W + COL_GAP;
const TRACE_R = COL_R + LABEL_MM;
const PANEL_X = COL_R + COL_W + COL_GAP;
const ROW_L = INNER_H / LEFT_LEADS.length;
const ROW_R = INNER_H / RIGHT_LEADS.length;

const C_ECG = "#00ff6a";
const C_PLETH = "#00e5ff";
const C_ALERT = "#ff3355";
const MONO = "ui-monospace,monospace";

/** Durée d'un cycle (bornes identiques à waveform.ts). */
function cycleSeconds(bpm: number) {
  return 60 / Math.max(20, Math.min(240, bpm));
}

/* ═══════════════════════════════════════════════════════════════════════
   Plein écran natif + verrouillage PAYSAGE
   ───────────────────────────────────────────────────────────────────────
   Trois étages, du meilleur au plus dégradé :

   1. `requestFullscreen()` sur la racine du moniteur → vrai plein écran OS
      (l'UI du navigateur disparaît, 100 % de l'écran est au moniteur) ;
   2. `screen.orientation.lock("landscape")` → l'OS fait tourner la page de
      90°, le moniteur remplit l'écran dans le bon sens ;
   3. si (1) ou (2) échoue — navigateur sans API, ou « rotation auto »
      désactivée au niveau du téléphone (Android refuse alors le lock) :
      repli CSS, le cadre est pivoté de 90° et ses dimensions échangées,
      uniquement sur un appareil TACTILE en PORTRAIT. Sur desktop, tout
      est no-op silencieux (les appels sont avalés par try/catch + .catch).

   Appareil SANS GYROSCOPE (aucun verrou OS possible) : le bouton « Paysage »
   de la barre d'outils force la rotation manuellement — c'est alors la seule
   commande utile, le badge passif n'étant plus qu'un indicateur d'état.

   À la sortie du plein écran (bouton, Échap, geste système) :
   `screen.orientation.unlock()` rend la main au système.
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * `screen.orientation` tel que typé par TypeScript ne déclare pas `lock()`
 * (API seulement implémentée par les moteurs, absente de lib.dom) : on la
 * décrit ici, en optionnel, pour pouvoir tester sa présence à l'exécution.
 */
type OrientationApi = { lock?: (o: "landscape") => Promise<void>; unlock?: () => void };

/** Préfixes webkit (Safari / vieux WebView Android) non déclarés par lib.dom. */
type PrefixedElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type PrefixedDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

function orientationApi(): OrientationApi | null {
  if (typeof screen === "undefined" || !screen.orientation) return null;
  return screen.orientation as unknown as OrientationApi;
}

/** Élément actuellement en plein écran natif (préfixe webkit inclus). */
function currentFullscreenElement(): Element | null {
  if (typeof document === "undefined") return null;
  const doc = document as PrefixedDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

/** Vrai plein écran OS. `false` si l'API refuse (on garde alors le CSS). */
async function requestNativeFullscreen(el: HTMLElement | null): Promise<boolean> {
  if (!el) return false;
  const node = el as PrefixedElement;
  try {
    if (typeof node.requestFullscreen === "function") await node.requestFullscreen();
    else if (typeof node.webkitRequestFullscreen === "function") await node.webkitRequestFullscreen();
    else return false;
    return true;
  } catch {
    return false; // refus utilisateur, iframe sans allowfullscreen, API coupée
  }
}

async function exitNativeFullscreen(): Promise<void> {
  if (typeof document === "undefined") return;
  const doc = document as PrefixedDocument;
  try {
    if (typeof doc.exitFullscreen === "function") await doc.exitFullscreen();
    else if (typeof doc.webkitExitFullscreen === "function") await doc.webkitExitFullscreen();
  } catch {
    /* déjà sorti du plein écran — rien à faire */
  }
}

/** tente le verrou paysage ; `false` si l'API est absente ou refuse. */
async function lockLandscape(): Promise<boolean> {
  try {
    const api = orientationApi();
    if (!api || typeof api.lock !== "function") return false;
    await api.lock("landscape");
    return true;
  } catch {
    return false; // desktop, iOS, ou verrouillage « rotation auto » Android
  }
}

function unlockOrientation(): void {
  try {
    orientationApi()?.unlock?.();
  } catch {
    /* `unlock()` n'existe pas partout : no-op silencieux */
  }
}

/** Appareil tactile actuellement en portrait (cible du repli rotation). */
function isTouchPortrait(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(pointer: coarse)").matches && window.innerHeight > window.innerWidth;
}

/**
 * Unités de viewport du repli rotation : `100dvh` / `100dvw` (hauteur
 * dynamique — barres d'outils mobiles comprises) si le moteur les connaît,
 * sinon `100vh` / `100vw`. Le fallback SSR et les vieux WebViews restent
 * fonctionnels.
 */
function viewportUnits(): { h: string; w: string } {
  if (typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("height", "100dvh")) {
    return { h: "100dvh", w: "100dvw" };
  }
  return { h: "100vh", w: "100vw" };
}

/* ═══════════════════════════════════════════════════════════════════════
   Rotation PAYSAGE FORCÉE à la main (appareils sans gyroscope)
   ───────────────────────────────────────────────────────────────────────
   Cible : tablettes / téléphones SANS capteur d'orientation. Le mobile
   n'est alors jamais physiquement tourné, donc `screen.orientation.lock()`
   échoue ou reste sans effet (Android refuse le verrou sans « rotation
   auto ») : le repli CSS est le SEUL moyen d'obtenir un tracé paysage.
   Le bouton dédié de la barre d'outils plein écran l'active explicitement ;
   la préférence est mémorisée pour la session suivante.
   ═══════════════════════════════════════════════════════════════════════ */

/** Clé de persistance de la préférence « forcer le paysage ». */
const FORCE_LANDSCAPE_KEY = "ecg.fullscreen.forceLandscape";

/** Préférence mémorisée (`false` si stockage indisponible — SSR, privé, iframe). */
function readForceLandscape(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(FORCE_LANDSCAPE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Mémorise la préférence ; l'état React reste la source de vérité. */
function writeForceLandscape(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(FORCE_LANDSCAPE_KEY, "true");
    else window.localStorage.removeItem(FORCE_LANDSCAPE_KEY);
  } catch {
    /* quota atteint / stockage bloqué : no-op silencieux */
  }
}

export function EcgMonitor({
  bpm = 75,
  soundType = "bip_normal",
  deformation,
  autoStart = true,
}: {
  bpm?: number;
  soundType?: SoundType;
  deformation?: EcgDeformation;
  autoStart?: boolean;
}) {
  const [playing, setPlaying] = useState(autoStart);
  const [sound, setSound] = useState(false);
  const [full, setFull] = useState(false);
  // Plein écran obtenu nativement par l'API (vs. repli CSS `fixed inset-0`).
  const [nativeFull, setNativeFull] = useState(false);
  // Le verrou paysage OS a été refusé (mobile sans gyroscope, « rotation auto »
  // coupée) → il faut pivoter le cadre nous-mêmes.
  const [autoLockRefused, setAutoLockRefused] = useState(false);
  // Rotation paysage DEMANDÉE à la main (bouton « Paysage ») : indispensable
  // sur un appareil sans capteur, où aucun verrou OS ne peut aboutir.
  const [forceLandscape, setForceLandscape] = useState<boolean>(readForceLandscape);
  // Appareil tactile en portrait — lu au rendu, rafraîchi au resize.
  const [touchPortrait, setTouchPortrait] = useState(false);
  const [gainManual, setGainManual] = useState<EcgGain | null>(null);
  const [viewport, setViewport] = useState({ w: 1280, h: 800 });

  // Élément passé à `requestFullscreen()` (racine du moniteur).
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Groupes défilants : transform mis à jour hors React (perf).
  const leftScrollRef = useRef<SVGGElement | null>(null);
  const rightScrollRef = useRef<SVGGElement | null>(null);

  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const cid = (lead: string) => `ecgcyc${uid}${lead.replace(/[^a-zA-Z0-9]/g, "")}`;
  const clipL = `ecgclipL${uid}`;
  const clipR = `ecgclipR${uid}`;
  const gridMin = `ecggmin${uid}`;
  const gridMaj = `ecggmaj${uid}`;

  /*
   * Gain : automatique (5 mm/mV sur MOBILE EN PAYSAGE, où les lignes sont
   * courtes) sauf si l'utilisateur a choisi un palier à la main.
   * Plancher volontaire à 5 mm/mV — jamais 2,5 (cf. README).
   */
  const autoReduced = viewport.w < 900 && viewport.w >= viewport.h;
  const gain: EcgGain = gainManual ?? (autoReduced ? ECG_GAIN_REDUCED : 10);
  const reduced = gain < 10;

  // Un cycle par dérivation (mémoïsé) — jamais recalculé pendant le scroll.
  const cycles = useMemo(() => {
    const out: Record<string, { d: string; cycleSec: number; widthMm: number }> = {};
    for (const lead of ALL_LEADS) {
      out[lead] = cyclePathMm(lead, {
        bpm,
        def: deformation,
        gainMmPerMv: gain,
        mmPerSec: MM_PER_SEC,
      });
    }
    return out;
  }, [bpm, deformation, gain]);

  const cycleSec = cycleSeconds(bpm);

  // Défilement : on ne touche QUE le transform des deux colonnes (aucun re-render).
  useEffect(() => {
    if (!playing) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const phase = (((now - start) / 1000) % cycleSec) * MM_PER_SEC;
      const tf = `translate(${(-phase).toFixed(3)},0)`;
      leftScrollRef.current?.setAttribute("transform", tf);
      rightScrollRef.current?.setAttribute("transform", tf);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `full` : le plein écran passe par un PORTAL, ce qui change les nœuds DOM
    // référencés par `leftScrollRef` / `rightScrollRef` → il faut réattacher
    // la boucle de défilement à la nouvelle instance.
  }, [playing, cycleSec, full]);

  useEcgBeep({ enabled: sound && playing, bpm, soundType });

  useEffect(() => {
    const onResize = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
      // Cible tactile + portrait : condition d'application du repli. Passer en
      // paysage (verrou accepté, ou appareil réellement tourné) l'annule de
      // fait, la valeur dérivée `rotateFallback` retombant à `false`.
      setTouchPortrait(isTouchPortrait());
    };
    onResize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  /*
   * Plein écran : défilement verrouillé au niveau RACINE (`html` + `body`).
   * Indispensable au repli rotation, qui ancre le cadre hors écran
   * (`left: 100vw`) avant de le pivoter : sans ce verrou, ce débordement
   * transitoire peut produire une barre de défilement horizontale.
   */
  useEffect(() => {
    if (!full) return;
    const bodyPrev = document.body.style.overflow;
    const htmlPrev = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = bodyPrev;
      document.documentElement.style.overflow = htmlPrev;
    };
  }, [full]);

  /*
   * Entrée en plein écran : fullscreen natif → verrou paysage → repli CSS.
   * L'état `full` est posé D'ABORD (plein écran CSS immédiat) : on a toujours
   * un moniteur plein écran même si l'API native est indisponible ou refusée.
   *
   * L'appel `requestFullscreen()` vit dans un effet (et non dans le handler de
   * clic) : le plein écran s'obtient sur le nœud du PORTAL, qui n'existe
   * qu'après le re-rendu. Reste dans la fenêtre d'activation utilisateur
   * (Chrome ≈ 5 s), donc l'API l'accepte.
   */
  useEffect(() => {
    if (!full) return;
    let cancelled = false;
    void (async () => {
      const native = await requestNativeFullscreen(rootRef.current);
      if (cancelled) return;
      setNativeFull(native);
      const locked = native ? await lockLandscape() : false;
      // Le verrou paysage a échoué (ou pas de plein écran natif) sur un mobile
      // en portrait → on note le refus, le repli CSS s'appliquera alors même
      // sans intervention de l'utilisateur (appareil sans gyroscope).
      if (!cancelled) {
        setAutoLockRefused(!locked);
        setTouchPortrait(isTouchPortrait());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [full]);

  /** Quitte le mode forcé (état + préférence mémorisée). */
  const clearForceLandscape = useCallback(() => {
    setForceLandscape(false);
    writeForceLandscape(false);
  }, []);

  const exitFullscreen = useCallback(async () => {
    unlockOrientation(); // rend la rotation au système
    setAutoLockRefused(false);
    clearForceLandscape(); // la rotation forcée ne survit pas à la sortie
    setNativeFull(false);
    setFull(false);
    await exitNativeFullscreen();
  }, [clearForceLandscape]);

  const toggleFullscreen = useCallback(() => {
    if (full) void exitFullscreen();
    else setFull(true); // le reste (fullscreen natif, verrou) suit dans l'effet
  }, [full, exitFullscreen]);

  /*
   * Bouton « Paysage » : la SEULE commande utilisable sur un appareil sans
   * gyroscope, où `screen.orientation.lock()` ne peut pas aboutir. On tente
   * quand même le verrou OS (il réussit sur un appareil équipé, ce qui évite
   * une double rotation : la page tourne alors réellement, `touchPortrait`
   * passe à faux et le repli CSS se désactive de lui-même) ; sinon la valeur
   * dérivée `rotateFallback` prend le relais.
   */
  const toggleForceLandscape = useCallback(() => {
    if (forceLandscape) {
      unlockOrientation();
      setForceLandscape(false);
      // Le repli automatique (verrou OS refusé) est neutralisé lui aussi :
      // sans cela, appuyer sur le bouton pour REVENIR en portrait n'aurait
      // aucun effet sur un appareil sans gyroscope (le refus restant vrai).
      setAutoLockRefused(false);
      writeForceLandscape(false);
      return;
    }
    const api = orientationApi();
    void api?.lock?.("landscape")?.catch(() => {}); // no-op si l'API est absente
    setForceLandscape(true);
    writeForceLandscape(true);
  }, [forceLandscape]);

  /*
   * Sortie de plein écran décidée par le SYSTÈME (Échap, geste retour,
   * bouton « quitter » du navigateur) : on synchronise l'état React et on
   * libère l'orientation. Rien à faire à l'entrée : `full` est déjà posé.
   */
  useEffect(() => {
    const onFullscreenChange = () => {
      const active = currentFullscreenElement() !== null;
      setNativeFull(active);
      if (active) return;
      unlockOrientation();
      setAutoLockRefused(false);
      clearForceLandscape();
      setFull(false);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    };
  }, [clearForceLandscape]);

  // Démontage (navigation vers une autre page) pendant le plein écran.
  useEffect(
    () => () => {
      unlockOrientation();
      void exitNativeFullscreen();
      writeForceLandscape(false); // préférence remise à zéro à la sortie
    },
    [],
  );

  const leadNode = (lead: string, x: number, yMid: number) => {
    const c = cycles[lead];
    const copies = Math.ceil(TRACE_MM / c.widthMm) + 2;
    const isPleth = lead === "PLETH";
    return (
      <g
        key={lead}
        transform={`translate(${x},${yMid.toFixed(2)})`}
        data-ecg-lead={lead}
        data-ecg-baseline={yMid.toFixed(2)}
        data-ecg-cycle-mm={c.widthMm.toFixed(2)}
      >
        {Array.from({ length: copies }, (_, k) => (
          <use
            key={k}
            href={`#${cid(lead)}`}
            x={(k * c.widthMm).toFixed(2)}
            data-ecg-cycle={k}
            fill="none"
            stroke={isPleth ? C_PLETH : C_ECG}
            strokeWidth={0.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </g>
    );
  };

  /*
   * Plein écran : le cadre occupe tout l'écran (`h-screen w-screen`), en
   * colonne, et c'est le SVG qui absorbe la place restante (`flex-1`) —
   * aucun `max-height` résiduel pour brider le tracé.
   *
   * Repli rotation (verrou paysage refusé) — le conteneur interne sort du
   * flux (`position: fixed`), ses dimensions sont ÉCHANGÉES (largeur =
   * hauteur d'écran, hauteur = largeur d'écran), il est ancré au bord droit
   * de l'écran (`left: 100vw`) puis pivoté de 90° autour de son coin
   * haut-gauche. Calcul : le coin local (0,0) tombe en (100vw, 0), la largeur
   * locale (100vh) descend le long du bord droit (0 → 100vh en ordonnée), la
   * hauteur locale (100vw) repart vers la gauche (100vw → 0 en abscisse) —
   * le cadre recouvre donc EXACTEMENT la surface de l'écran, sans bande vide.
   * `100dvh` / `100dvw` (viewports dynamiques) quand le moteur les connaît,
   * sinon `vh` / `vw`. Les styles sont conditionnels : sur desktop
   * `rotateFallback` est toujours faux → le bloc n'est JAMAIS appliqué.
   */
  const rotateFallback = full && touchPortrait && (autoLockRefused || forceLandscape);
  const vpUnits = viewportUnits();
  const rotateStyle: CSSProperties | undefined = rotateFallback
    ? {
        position: "fixed",
        top: 0,
        left: vpUnits.w,
        width: vpUnits.h,
        height: vpUnits.w,
        transform: "rotate(90deg)",
        transformOrigin: "top left",
        overflow: "hidden",
      }
    : undefined;

  /*
   * Le repli rotation s'applique à un CONTENEUR INTERNE, jamais à l'élément
   * plein écran lui-même : la feuille de style du navigateur impose
   * `:fullscreen { position: fixed; inset: 0; width/height: 100%;
   * transform: none !important }` — l'élément plein écran ne peut donc ni
   * être redimensionné ni pivoté. La racine, elle, occupe toujours l'écran ;
   * c'est son contenu qui pivote.
   */
  const innerClass = full ? "relative flex h-full w-full flex-col" : "";

  const monitor = (
    <div
      ref={rootRef}
      data-ecg-monitor=""
      data-ecg-bpm={bpm}
      data-ecg-gain={gain}
      data-ecg-reduced={reduced ? "true" : "false"}
      data-ecg-leads={ALL_LEADS.join(" ")}
      data-ecg-fullscreen-mode={nativeFull ? "native" : full ? "css" : "off"}
      data-ecg-rotate-fallback={rotateFallback ? "true" : "false"}
      data-ecg-force-landscape={forceLandscape ? "true" : "false"}
      className={
        "overflow-hidden bg-black ring-1 ring-black/60 shadow-[var(--shadow-md)] " +
        (full
          ? "fixed left-0 top-0 z-50 h-screen w-screen rounded-none"
          : "relative rounded-[var(--radius-xl)]")
      }
    >
      <div className={innerClass} style={rotateStyle}>
        {/* En plein écran la barre d'outils est SUPERPOSÉE au tracé (et non
            empilée au-dessus) : le tracé récupère les ~10 % de hauteur qu'elle
            occupait, seul moyen de vraiment remplir l'écran au format papier
            (296 × 140 mm ≈ 2,11:1 vs ~2,16:1 pour un écran de téléphone). */}
        <div
          className={
            "flex shrink-0 items-center gap-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider " +
            (full
              ? "absolute inset-x-0 top-0 z-10 bg-black/75"
              : "border-b border-white/5")
          }
        >
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-emerald-400" />
            MONITOR<span className="hidden sm:inline"> · 12 DÉRIVATIONS</span>
          </span>
          <span
            data-ecg-gain-label=""
            className={reduced ? "font-semibold text-amber-400" : "hidden text-white/30 sm:inline"}
          >
            25 mm/s · {gain} mm/mV
          </span>
          {reduced ? (
            <span
              data-ecg-gain-badge=""
              className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-400/40"
            >
              Gain réduit
            </span>
          ) : null}
          <span className="ml-auto flex items-center gap-2">
            <span className="flex items-center rounded-full bg-white/5 p-0.5" data-ecg-gain-toggle="">
              {ECG_GAIN_STEPS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGainManual(g)}
                  aria-pressed={gain === g}
                  aria-label={`Gain ${g} mm/mV`}
                  data-ecg-set-gain={g}
                  className={
                    "rounded-full px-2 py-0.5 font-mono text-[10px] tabular-nums transition-colors " +
                    (gain === g ? "bg-emerald-400/25 text-emerald-200" : "text-white/45 hover:bg-white/10")
                  }
                >
                  <span className="hidden sm:inline">Gain </span>
                  {g}
                </button>
              ))}
            </span>
            <button
              type="button"
              onClick={() => setPlaying((v) => !v)}
              aria-label={playing ? "Pause" : "Lecture"}
              className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70 hover:bg-white/20"
            >
              {playing ? "❙❙" : "▶"}
            </button>
            <button
              type="button"
              onClick={() => setSound((v) => !v)}
              aria-label={sound ? "Couper le son" : "Activer le son"}
              className={
                "rounded-full px-2 py-0.5 text-[10px] " +
                (sound ? "bg-emerald-400/20 text-emerald-300" : "bg-white/10 text-white/40")
              }
            >
              {sound ? "🔊" : "🔈"}
            </button>
            {/* Bouton « Paysage » — plein écran uniquement. Sur un appareil SANS
                gyroscope, c'est le seul moyen d'obtenir le tracé en paysage :
                le verrou OS ne peut pas aboutir, on pivote alors le cadre en CSS.
                Actif, il passe en or (#A67C1E) pour signaler le mode forcé. */}
            {full ? (
              <button
                type="button"
                onClick={toggleForceLandscape}
                aria-pressed={forceLandscape}
                aria-label="Forcer l'affichage paysage"
                data-ecg-force-landscape-toggle=""
                className={
                  "rounded-full px-2 py-0.5 text-[10px] transition-colors " +
                  (forceLandscape
                    ? "bg-[#A67C1E] text-black"
                    : "bg-white/10 text-white/70 hover:bg-white/20")
                }
              >
                {/* Smartphone pivoté à 90° (SVG inline — aucune dépendance). */}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-3"
                  aria-hidden="true"
                >
                  <rect x="2" y="6" width="20" height="12" rx="2.5" />
                  <line x1="5.5" y1="12" x2="8" y2="12" />
                  <line x1="19" y1="10.5" x2="19" y2="13.5" />
                </svg>
              </button>
            ) : null}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={full ? "Quitter le plein écran" : "Plein écran (paysage)"}
              data-ecg-fullscreen=""
              className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70 hover:bg-white/20"
            >
              {full ? <Minimize2 className="size-3" /> : <Maximize2 className="size-3" />}
            </button>
          </span>
        </div>

        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className={full ? "block max-h-none min-h-0 w-full flex-1" : "block w-full"}
          style={full ? undefined : { aspectRatio: `${VIEW_W}/${VIEW_H}` }}
          preserveAspectRatio="xMidYMid meet"
          data-ecg-svg=""
          data-ecg-viewbox={`0 0 ${VIEW_W} ${VIEW_H}`}
          data-ecg-sweep={SWEEP}
          data-ecg-mm-per-sec={MM_PER_SEC}
          data-ecg-mm-per-mv={gain}
          aria-label={`Moniteur ECG 12 dérivations à ${bpm} bpm — gain ${gain} mm/mV`}
          role="img"
        >
          <defs>
            <pattern id={gridMin} width="1" height="1" patternUnits="userSpaceOnUse">
              <path d="M 1 0 L 0 0 0 1" fill="none" stroke="rgba(0,255,100,0.07)" strokeWidth="0.09" />
            </pattern>
            <pattern id={gridMaj} width="5" height="5" patternUnits="userSpaceOnUse">
              <rect width="5" height="5" fill={`url(#${gridMin})`} />
              <path d="M 5 0 L 0 0 0 5" fill="none" stroke="rgba(0,255,100,0.15)" strokeWidth="0.16" />
            </pattern>
            <clipPath id={clipL}>
              <rect x={TRACE_L} y={PAD_TOP} width={TRACE_MM} height={INNER_H} />
            </clipPath>
            <clipPath id={clipR}>
              <rect x={TRACE_R} y={PAD_TOP} width={TRACE_MM} height={INNER_H} />
            </clipPath>
            {/* Un seul cycle par dérivation — répété par <use> ensuite. */}
            {ALL_LEADS.map((lead) => (
              <path key={lead} id={cid(lead)} d={cycles[lead].d} fill="none" />
            ))}
          </defs>

          <rect width={VIEW_W} height={VIEW_H} fill={`url(#${gridMaj})`} data-ecg-grid="" />
          <line
            x1={COL_R - COL_GAP / 2}
            y1={PAD_TOP}
            x2={COL_R - COL_GAP / 2}
            y2={VIEW_H - PAD_BOTTOM}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="0.12"
          />

          {/* Colonne gauche — cycles répétés, défilement par translate. */}
          <g clipPath={`url(#${clipL})`}>
            <g ref={leftScrollRef} data-ecg-scroll="left">
              {LEFT_LEADS.map((lead, i) => leadNode(lead, TRACE_L, PAD_TOP + ROW_L * (i + 0.5)))}
            </g>
          </g>
          {/* Colonne droite */}
          <g clipPath={`url(#${clipR})`}>
            <g ref={rightScrollRef} data-ecg-scroll="right">
              {RIGHT_LEADS.map((lead, i) => leadNode(lead, TRACE_R, PAD_TOP + ROW_R * (i + 0.5)))}
            </g>
          </g>

          {/* Lignes de base + libellés (statiques, non clippés). */}
          {LEFT_LEADS.map((lead, i) => {
            const yMid = PAD_TOP + ROW_L * (i + 0.5);
            return (
              <g key={lead}>
                <line x1={TRACE_L} y1={yMid} x2={TRACE_L + TRACE_MM} y2={yMid} stroke="rgba(0,255,100,0.05)" strokeWidth="0.06" />
                <text x={COL_L} y={yMid + 1.2} fontSize="3.4" fontFamily={MONO} fontWeight="700" fill={lead === "PLETH" ? C_PLETH : C_ECG}>
                  {lead}
                </text>
              </g>
            );
          })}
          {RIGHT_LEADS.map((lead, i) => {
            const yMid = PAD_TOP + ROW_R * (i + 0.5);
            return (
              <g key={lead}>
                <line x1={TRACE_R} y1={yMid} x2={TRACE_R + TRACE_MM} y2={yMid} stroke="rgba(0,255,100,0.05)" strokeWidth="0.06" />
                <text x={COL_R} y={yMid + 1.2} fontSize="3.4" fontFamily={MONO} fontWeight="700" fill={C_ECG}>
                  {lead}
                </text>
              </g>
            );
          })}

          {/* Curseur de balayage (bord droit du tracé). */}
          <line x1={TRACE_L + TRACE_MM} y1={PAD_TOP} x2={TRACE_L + TRACE_MM} y2={VIEW_H - PAD_BOTTOM} stroke="rgba(0,255,106,0.45)" strokeWidth="0.35" data-ecg-cursor="left" />
          <line x1={TRACE_R + TRACE_MM} y1={PAD_TOP} x2={TRACE_R + TRACE_MM} y2={VIEW_H - PAD_BOTTOM} stroke="rgba(0,255,106,0.45)" strokeWidth="0.35" data-ecg-cursor="right" />

          {/* Panneau de constantes. */}
          <line x1={PANEL_X - COL_GAP / 2} y1={PAD_TOP} x2={PANEL_X - COL_GAP / 2} y2={VIEW_H - PAD_BOTTOM} stroke="rgba(255,255,255,0.08)" strokeWidth="0.12" />
          <text x={PANEL_X} y={PAD_TOP + 5} fontSize="3.6" fontFamily={MONO} fontWeight="700" fill={C_ECG}>ECG</text>
          <text x={VIEW_W - PAD_X} y={PAD_TOP + 5.4} fontSize="4.4" fontFamily={MONO} fill={C_ALERT} textAnchor="end">♥</text>
          <line x1={PANEL_X - COL_GAP / 2} y1={PAD_TOP + 8} x2={VIEW_W - PAD_X} y2={PAD_TOP + 8} stroke="rgba(255,255,255,0.08)" strokeWidth="0.12" />
          <text x={PANEL_X} y={PAD_TOP + 26} fontSize="15" fontFamily={MONO} fontWeight="700" fill={C_ECG}>{bpm}</text>
          <text x={PANEL_X + 23} y={PAD_TOP + 26} fontSize="3.4" fontFamily={MONO} fill="rgba(0,255,106,0.5)">bpm</text>
          <line x1={PANEL_X - COL_GAP / 2} y1={PAD_TOP + 32} x2={VIEW_W - PAD_X} y2={PAD_TOP + 32} stroke="rgba(255,255,255,0.08)" strokeWidth="0.12" />
          <text x={PANEL_X} y={PAD_TOP + 40} fontSize="3.4" fontFamily={MONO} fontWeight="700" fill="#ffffff">NIBP</text>
          <text x={PANEL_X} y={PAD_TOP + 52} fontSize="9" fontFamily={MONO} fontWeight="700" fill="#ffffff">117</text>
          <text x={PANEL_X + 17} y={PAD_TOP + 52} fontSize="6.5" fontFamily={MONO} fontWeight="700" fill="#ffffff">81</text>
          <text x={PANEL_X} y={PAD_TOP + 58} fontSize="2.6" fontFamily={MONO} fill="rgba(255,255,255,0.35)">mmHg</text>
          <line x1={PANEL_X - COL_GAP / 2} y1={PAD_TOP + 62} x2={VIEW_W - PAD_X} y2={PAD_TOP + 62} stroke="rgba(255,255,255,0.08)" strokeWidth="0.12" />
          <text x={PANEL_X} y={PAD_TOP + 70} fontSize="3.4" fontFamily={MONO} fontWeight="700" fill={C_PLETH}>SpO₂</text>
          <text x={PANEL_X} y={PAD_TOP + 86} fontSize="12" fontFamily={MONO} fontWeight="700" fill={C_PLETH}>97</text>
          <text x={PANEL_X + 25} y={PAD_TOP + 86} fontSize="4" fontFamily={MONO} fontWeight="700" fill={C_PLETH}>%</text>
          <line x1={PANEL_X - COL_GAP / 2} y1={PAD_TOP + 92} x2={VIEW_W - PAD_X} y2={PAD_TOP + 92} stroke="rgba(255,255,255,0.08)" strokeWidth="0.12" />
          <text x={PANEL_X} y={PAD_TOP + 100} fontSize="3.4" fontFamily={MONO} fontWeight="700" fill="#ffffff">TEMP</text>
          <text x={PANEL_X} y={PAD_TOP + 114} fontSize="9" fontFamily={MONO} fontWeight="700" fill="#ffffff">37.0</text>
          <text x={PANEL_X + 22} y={PAD_TOP + 114} fontSize="3" fontFamily={MONO} fill="rgba(255,255,255,0.4)">°C</text>
        </svg>
      </div>
      {/* Mini-indicateur d'état — HORS du conteneur pivoté, donc toujours
          lisible à l'écran (il ne fait que CONFIRMER le mode, non cliquable :
          l'action passe par le bouton « Paysage » de la barre d'outils). */}
      {full && rotateFallback ? (
        <div
          data-ecg-orientation-hint=""
          className="pointer-events-none absolute bottom-1.5 right-2 z-10 font-mono text-[9px] tracking-wide text-white/40"
        >
          {forceLandscape ? "⟳ paysage forcé" : "⟳ rotation auto indisponible"}
        </div>
      ) : null}
    </div>
  );

  /*
   * ── PORTAL ──────────────────────────────────────────────────────────────
   * Rester dans le flux de la page ne suffit PAS : `main > * { animation:
   * page-reveal … both }` (styles.css) laisse sur le conteneur de page un
   * `transform: translateY(0)` PERMANENT (fill-mode `both`), or tout
   * `transform` — même une identité — crée un **bloc conteneur** pour
   * `position: fixed`. Le plein écran se retrouvait alors calé sur la zone de
   * contenu (décalé sous l'en-tête, tronqué par la sidebar) au lieu de
   * l'écran : d'où le « noir en haut, tracé en bas ».
   * On monte donc le moniteur plein écran directement sous <body>, hors de
   * toute transformation d'ancêtre. Le plein écran NATIF (top layer) est
   * immunisé par nature ; le portal sécurise le repli CSS.
   * `document` n'est touché que lorsque `full` est vrai (jamais en SSR).
   */
  if (full && typeof document !== "undefined") return createPortal(monitor, document.body);
  return monitor;
}
