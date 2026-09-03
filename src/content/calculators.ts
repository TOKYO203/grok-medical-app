export function cockcroftGault(opts: {
  age: number;
  weightKg: number;
  creatinineUmol: number;
  female: boolean;
}): number {
  const { age, weightKg, creatinineUmol, female } = opts;
  if (age <= 0 || weightKg <= 0 || creatinineUmol <= 0) return 0;
  const raw = ((140 - age) * weightKg) / (creatinineUmol * 0.814);
  return Math.round((female ? raw * 0.85 : raw) * 10) / 10;
}

/** CKD-EPI 2021 without race, creatinine in µmol/L. */
export function ckdEpi(opts: { age: number; creatinineUmol: number; female: boolean }): number {
  const scr = opts.creatinineUmol / 88.4;
  const k = opts.female ? 0.7 : 0.9;
  const a = opts.female ? -0.241 : -0.302;
  const min = Math.min(scr / k, 1);
  const max = Math.max(scr / k, 1);
  const sex = opts.female ? 1.012 : 1;
  const gfr = 142 * min ** a * max ** -1.2 * 0.9938 ** opts.age * sex;
  return Math.round(gfr * 10) / 10;
}

export function bmi(weightKg: number, heightCm: number): number {
  if (weightKg <= 0 || heightCm <= 0) return 0;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function bmiClass(value: number): string {
  if (value <= 0) return "—";
  if (value < 18.5) return "Maigreur";
  if (value < 25) return "Normale";
  if (value < 30) return "Surpoids";
  if (value < 35) return "Obésité I";
  if (value < 40) return "Obésité II";
  return "Obésité III";
}

export function cha2ds2Vasc(flags: {
  chf: boolean;
  htn: boolean;
  age75: boolean;
  age65: boolean;
  diabetes: boolean;
  stroke: boolean;
  vascular: boolean;
  female: boolean;
}): { score: number; risk: string } {
  let score = 0;
  if (flags.chf) score += 1;
  if (flags.htn) score += 1;
  if (flags.age75) score += 2;
  else if (flags.age65) score += 1;
  if (flags.diabetes) score += 1;
  if (flags.stroke) score += 2;
  if (flags.vascular) score += 1;
  if (flags.female) score += 1;
  let risk = "Faible — discuter au cas par cas";
  if (score === 0) risk = "Très faible — pas d'AOD en l'absence d'autre indication";
  else if (score === 1) risk = "Faible — AOD à discuter (surtout si non-sexe)";
  else risk = "Élevé — AOD recommandé sauf contre-indication";
  return { score, risk };
}

export function gcs(eye: number, verbal: number, motor: number): { total: number; label: string } {
  const total = eye + verbal + motor;
  let label = "Légère";
  if (total <= 8) label = "Sévère — protéger les voies aériennes";
  else if (total <= 12) label = "Modérée";
  return { total, label };
}

export function qtcBazett(qtMs: number, hrBpm: number): { qtc: number; label: string } {
  if (qtMs <= 0 || hrBpm <= 0) return { qtc: 0, label: "—" };
  const rr = 60 / hrBpm;
  const qtc = Math.round(qtMs / Math.sqrt(rr));
  let label = "Normal";
  if (qtc >= 500) label = "Très allongé — risque de TdP";
  else if (qtc >= 480) label = "Allongé";
  else if (qtc >= 450) label = "Limite";
  return { qtc, label };
}

export function wellsPe(flags: {
  signsDvt: boolean;
  altLessLikely: boolean;
  hr100: boolean;
  immobilization: boolean;
  previous: boolean;
  hemoptysis: boolean;
  malignancy: boolean;
}): { score: number; label: string } {
  let score = 0;
  if (flags.signsDvt) score += 3;
  if (flags.altLessLikely) score += 3;
  if (flags.hr100) score += 1.5;
  if (flags.immobilization) score += 1.5;
  if (flags.previous) score += 1.5;
  if (flags.hemoptysis) score += 1;
  if (flags.malignancy) score += 1;
  let label = "Faible probabilité";
  if (score > 6) label = "Forte probabilité";
  else if (score >= 2) label = "Probabilité intermédiaire";
  return { score, label };
}

export function curb65(flags: {
  confusion: boolean;
  urea: boolean;
  rr: boolean;
  bp: boolean;
  age65: boolean;
}): { score: number; label: string } {
  const score =
    Number(flags.confusion) + Number(flags.urea) + Number(flags.rr) + Number(flags.bp) + Number(flags.age65);
  let label = "Faible — ambulatoire possible";
  if (score >= 3) label = "Élevé — hospitalisation / réa à discuter";
  else if (score >= 2) label = "Intermédiaire — hospitalisation";
  else if (score === 1) label = "Faible-intermédiaire — évaluer le terrain";
  return { score, label };
}
