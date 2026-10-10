import indexJson from "@/content/data/ecg/_index.json";
import normal001 from "@/content/data/ecg/normal-001.json";
import ecg11Vitesse from "@/content/data/ecg/ecg-1-1-vitesse.json";
import ecg12IdmEtalonnage from "@/content/data/ecg/ecg-1-2-idm-etalonnage.json";
import ecg13Sncf from "@/content/data/ecg/ecg-1-3-sncf.json";
import ecg15Malposition from "@/content/data/ecg/ecg-1-5-malposition.json";
import ecg21Digitalique from "@/content/data/ecg/ecg-2-1-digitalique.json";
import ecg23Bav2Mobitz2 from "@/content/data/ecg/ecg-2-3-bav2-mobitz2.json";
import ecg24Bav2Mobitz1 from "@/content/data/ecg/ecg-2-4-bav2-mobitz1.json";
import ecg25Bav3Verapamil from "@/content/data/ecg/ecg-2-5-bav3-verapamil.json";
import ecg31Riva from "@/content/data/ecg/ecg-3-1-riva.json";
import ecg32Flutter21 from "@/content/data/ecg/ecg-3-2-flutter-2-1.json";
import ecg33FaOap from "@/content/data/ecg/ecg-3-3-fa-oap.json";
import ecg37Tv from "@/content/data/ecg/ecg-3-7-tv.json";
import ecg38Torsades from "@/content/data/ecg/ecg-3-8-torsades.json";
import ecg46PacemakerIdm from "@/content/data/ecg/ecg-4-6-pacemaker-idm.json";
import ecg47QrsFragmentes from "@/content/data/ecg/ecg-4-7-qrs-fragmentes.json";
import ecg51Pericardite from "@/content/data/ecg/ecg-5-1-pericardite.json";
import ecg514Brugada from "@/content/data/ecg/ecg-5-14-brugada.json";
import ecg52Hypothermie from "@/content/data/ecg/ecg-5-2-hypothermie.json";
import ecg53Hyperkaliemie from "@/content/data/ecg/ecg-5-3-hyperkaliemie.json";
import ecg57RythmeEctopique from "@/content/data/ecg/ecg-5-7-rythme-ectopique.json";
import ecg58HemorragieCerebrale from "@/content/data/ecg/ecg-5-8-hemorragie-cerebrale.json";
import ecg59RepolarisationPrecoce from "@/content/data/ecg/ecg-5-9-repolarisation-precoce.json";
import type { EcgCase } from "@/core/ecg";

/**
 * Chargeur de cas ECG — index + contenu (bundle statique pour offline).
 *
 * ⚠️ Chaque fichier de `_index.json` DOIT être enregistré ici : tout cas
 * indexé mais absent de `CASES_BY_FILE` rend `getEcg()` → `undefined`
 * (« Cas ECG introuvable »). Les données Adnet/Lapostolle sont « légères »
 * (pas de `metrics`/`intervals`/`waveforms`), d'où le cast `unknown → EcgCase`.
 */
const CASES_BY_FILE: Record<string, EcgCase> = {
  "normal-001.json": normal001 as unknown as EcgCase,
  "ecg-1-1-vitesse.json": ecg11Vitesse as unknown as EcgCase,
  "ecg-1-2-idm-etalonnage.json": ecg12IdmEtalonnage as unknown as EcgCase,
  "ecg-1-3-sncf.json": ecg13Sncf as unknown as EcgCase,
  "ecg-1-5-malposition.json": ecg15Malposition as unknown as EcgCase,
  "ecg-2-1-digitalique.json": ecg21Digitalique as unknown as EcgCase,
  "ecg-2-3-bav2-mobitz2.json": ecg23Bav2Mobitz2 as unknown as EcgCase,
  "ecg-2-4-bav2-mobitz1.json": ecg24Bav2Mobitz1 as unknown as EcgCase,
  "ecg-2-5-bav3-verapamil.json": ecg25Bav3Verapamil as unknown as EcgCase,
  "ecg-3-1-riva.json": ecg31Riva as unknown as EcgCase,
  "ecg-3-2-flutter-2-1.json": ecg32Flutter21 as unknown as EcgCase,
  "ecg-3-3-fa-oap.json": ecg33FaOap as unknown as EcgCase,
  "ecg-3-7-tv.json": ecg37Tv as unknown as EcgCase,
  "ecg-3-8-torsades.json": ecg38Torsades as unknown as EcgCase,
  "ecg-4-6-pacemaker-idm.json": ecg46PacemakerIdm as unknown as EcgCase,
  "ecg-4-7-qrs-fragmentes.json": ecg47QrsFragmentes as unknown as EcgCase,
  "ecg-5-1-pericardite.json": ecg51Pericardite as unknown as EcgCase,
  "ecg-5-14-brugada.json": ecg514Brugada as unknown as EcgCase,
  "ecg-5-2-hypothermie.json": ecg52Hypothermie as unknown as EcgCase,
  "ecg-5-3-hyperkaliemie.json": ecg53Hyperkaliemie as unknown as EcgCase,
  "ecg-5-7-rythme-ectopique.json": ecg57RythmeEctopique as unknown as EcgCase,
  "ecg-5-8-hemorragie-cerebrale.json": ecg58HemorragieCerebrale as unknown as EcgCase,
  "ecg-5-9-repolarisation-precoce.json": ecg59RepolarisationPrecoce as unknown as EcgCase,
};

export type EcgIndexEntry = (typeof indexJson)["cases"][number];

export type EcgDifficulty = "intro" | "intermediate" | "advanced";

export function listEcg(): EcgIndexEntry[] {
  return indexJson.cases;
}

export function getEcg(id: string): EcgCase | undefined {
  const entry = indexJson.cases.find((c) => c.id === id);
  if (!entry) return undefined;
  return CASES_BY_FILE[entry.file];
}

export function countEcg(): number {
  return indexJson.cases.length;
}

/** Cas indexés dont le contenu n'est pas enregistré (contrôle d'intégrité). */
export function missingEcgFiles(): string[] {
  return indexJson.cases.filter((c) => !CASES_BY_FILE[c.file]).map((c) => c.id);
}
