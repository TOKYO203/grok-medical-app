import indexJson from "@/content/data/demarches/_index.json";
import douleurThoracique from "@/content/data/demarches/douleur-thoracique.json";
import dyspnee from "@/content/data/demarches/dyspnee.json";
import fievreAigue from "@/content/data/demarches/fievre-aigue.json";
import hemoptysie from "@/content/data/demarches/hemoptysie.json";
import syncope from "@/content/data/demarches/syncope.json";
import fievrePersistante from "@/content/data/demarches/fievre-persistante.json";
import adenopathie from "@/content/data/demarches/adenopathie.json";
import oedemesMi from "@/content/data/demarches/oedemes-mi.json";
import diarrheeAigue from "@/content/data/demarches/diarrhee-aigue.json";
import coliqueNephretique from "@/content/data/demarches/colique-nephretique.json";
import hemorragiesDigestives from "@/content/data/demarches/hemorragies-digestives.json";
import arretCirculatoire from "@/content/data/demarches/arret-circulatoire.json";
import hypoglycemie from "@/content/data/demarches/hypoglycemie.json";
import pneumothorax from "@/content/data/demarches/pneumothorax.json";
import epistaxis from "@/content/data/demarches/epistaxis.json";
import hemorragiePremierTrimestre from "@/content/data/demarches/hemorragie-premier-trimestre.json";
import hemorragieTroisiemeTrimestre from "@/content/data/demarches/hemorragie-troisieme-trimestre.json";
import ictereConjugueAdulte from "@/content/data/demarches/ictere-conjugue-adulte.json";
import ascite from "@/content/data/demarches/ascite.json";
import proteinurie from "@/content/data/demarches/proteinurie.json";
import hematurie from "@/content/data/demarches/hematurie.json";
import anomalieMiction from "@/content/data/demarches/anomalie-miction.json";
import agitation from "@/content/data/demarches/agitation.json";
import epanchementPleural from "@/content/data/demarches/epanchement-pleural.json";
import syndromeMediastinal from "@/content/data/demarches/syndrome-mediastinal.json";
import baisseAcuiteVisuelle from "@/content/data/demarches/baisse-acuite-visuelle.json";
import oeilRougeDouloureux from "@/content/data/demarches/oeil-rouge-douloureux.json";
import algiePelvienne from "@/content/data/demarches/algie-pelvienne.json";
import hemorragieGenitale from "@/content/data/demarches/hemorragie-genitale.json";
import erythemes from "@/content/data/demarches/erythemes.json";
import dysphagie from "@/content/data/demarches/dysphagie.json";
import splenomegalie from "@/content/data/demarches/splenomegalie.json";
import hepatomegalie from "@/content/data/demarches/hepatomegalie.json";
import syndromePolyuropolydipsique from "@/content/data/demarches/syndrome-polyuropolydipsique.json";
import lombalgie from "@/content/data/demarches/lombalgie.json";
import ecoulementOreilleOtalgie from "@/content/data/demarches/ecoulement-oreille-otalgie.json";
import dysphonie from "@/content/data/demarches/dysphonie.json";
import goitreNoduleThyroidien from "@/content/data/demarches/goitre-nodule-thyroidien.json";
import leucorrhee from "@/content/data/demarches/leucorrhee.json";
import amenorrheeSecondaire from "@/content/data/demarches/amenorrhee-secondaire.json";
import trismus from "@/content/data/demarches/trismus.json";
import contractureMachoires from "@/content/data/demarches/contracture-machoires.json";
import exophtalmie from "@/content/data/demarches/exophtalmie.json";
import type { DemarcheContent, DemarcheIndexEntry } from "@/core/demarche";

/**
 * Chargeur de démarches enrichies — index + contenu (bundle statique, offline).
 *
 * ⚠️ Chaque fichier déclaré `status: "available"` dans `_index.json` DOIT être
 * enregistré dans `CONTENT_BY_FILE`, sinon `getDemarcheContent()` renvoie
 * `undefined` et la route retombe silencieusement sur le stepper QCM seul.
 * Le garde-fou `scripts/demarches-catalog-integrity.test.mjs` verrouille ce lien.
 */
const CONTENT_BY_FILE: Record<string, DemarcheContent> = {
  "douleur-thoracique.json": douleurThoracique as unknown as DemarcheContent,
  "dyspnee.json": dyspnee as unknown as DemarcheContent,
  "fievre-aigue.json": fievreAigue as unknown as DemarcheContent,
  "hemoptysie.json": hemoptysie as unknown as DemarcheContent,
  "syncope.json": syncope as unknown as DemarcheContent,
  "fievre-persistante.json": fievrePersistante as unknown as DemarcheContent,
  "adenopathie.json": adenopathie as unknown as DemarcheContent,
  "oedemes-mi.json": oedemesMi as unknown as DemarcheContent,
  "diarrhee-aigue.json": diarrheeAigue as unknown as DemarcheContent,
  "colique-nephretique.json": coliqueNephretique as unknown as DemarcheContent,
  "hemorragies-digestives.json": hemorragiesDigestives as unknown as DemarcheContent,
  "arret-circulatoire.json": arretCirculatoire as unknown as DemarcheContent,
  "hypoglycemie.json": hypoglycemie as unknown as DemarcheContent,
  "pneumothorax.json": pneumothorax as unknown as DemarcheContent,
  "epistaxis.json": epistaxis as unknown as DemarcheContent,
  "hemorragie-premier-trimestre.json": hemorragiePremierTrimestre as unknown as DemarcheContent,
  "hemorragie-troisieme-trimestre.json": hemorragieTroisiemeTrimestre as unknown as DemarcheContent,
  "ictere-conjugue-adulte.json": ictereConjugueAdulte,
  "ascite.json": ascite,
  "proteinurie.json": proteinurie,
  "hematurie.json": hematurie,
  "anomalie-miction.json": anomalieMiction,
  "agitation.json": agitation,
  "epanchement-pleural.json": epanchementPleural,
  "syndrome-mediastinal.json": syndromeMediastinal,
  "baisse-acuite-visuelle.json": baisseAcuiteVisuelle,
  "oeil-rouge-douloureux.json": oeilRougeDouloureux,
  "algie-pelvienne.json": algiePelvienne,
  "hemorragie-genitale.json": hemorragieGenitale,
  "erythemes.json": erythemes,
  "dysphagie.json": dysphagie,
  "splenomegalie.json": splenomegalie,
  "hepatomegalie.json": hepatomegalie,
  "syndrome-polyuropolydipsique.json": syndromePolyuropolydipsique,
  "lombalgie.json": lombalgie,
  "ecoulement-oreille-otalgie.json": ecoulementOreilleOtalgie,
  "dysphonie.json": dysphonie,
  "goitre-nodule-thyroidien.json": goitreNoduleThyroidien,
  "leucorrhee.json": leucorrhee,
  "amenorrhee-secondaire.json": amenorrheeSecondaire,
  "trismus.json": trismus,
  "contracture-machoires.json": contractureMachoires,
  "exophtalmie.json": exophtalmie,
};

const INDEX: DemarcheIndexEntry[] = (indexJson as { demarches: DemarcheIndexEntry[] }).demarches;

/** Toutes les entrées du manifeste (disponibles et planifiées). */
export function listDemarcheSummaries(): DemarcheIndexEntry[] {
  return INDEX;
}

/** Contenu enrichi d'une démarche, résolu par `diagnosticId` ou par `slug`. */
export function getDemarcheContent(diagnosticId: string): DemarcheContent | undefined {
  const entry = INDEX.find((item) => item.diagnosticId === diagnosticId || item.slug === diagnosticId);
  if (!entry) return undefined;
  return CONTENT_BY_FILE[entry.file];
}

/** `true` si une démarche enrichie existe pour ce QCM. */
export function hasDemarcheContent(diagnosticId: string): boolean {
  return getDemarcheContent(diagnosticId) !== undefined;
}

/** Fichiers déclarés disponibles mais absents du registre (diagnostic d'intégrité). */
export function missingDemarcheFiles(): string[] {
  return INDEX.filter((entry) => entry.status === "available" && !CONTENT_BY_FILE[entry.file]).map(
    (entry) => entry.file,
  );
}
