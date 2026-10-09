import type { ReactNode } from "react";
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Check } from "lucide-react";
import { Page, PageHeader, Shell } from "@/components/shell";
import { Input } from "@/components/ui/input";
import {
  bmi,
  bmiClass,
  cha2ds2Vasc,
  ckdEpi,
  cockcroftGault,
  curb65,
  gcs,
  qtcBazett,
  wellsPe,
} from "@/content/calculators";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calculateurs")({ component: CalcPage });

const TABS = [
  { id: "gfr", label: "DFG" },
  { id: "bmi", label: "IMC" },
  { id: "chads", label: "CHA₂DS₂" },
  { id: "gcs", label: "Glasgow" },
  { id: "qtc", label: "QTc" },
  { id: "wells", label: "Wells EP" },
  { id: "curb", label: "CURB-65" },
] as const;

type Tab = (typeof TABS)[number]["id"];

function CalcPage() {
  const [tab, setTab] = useState<Tab>("gfr");
  return (
    <Shell title="Calculateurs">
      <Page className="mx-auto max-w-2xl">
        <PageHeader
          kicker="Outils cliniques"
          title="Calculateurs"
          description="Scores et règles de décision utilisables hors ligne. Ils éclairent la décision — ils ne remplacent jamais le jugement clinique."
        />

        <div
          className="mt-5 -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0"
          role="tablist"
          aria-label="Choisir un calculateur"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex shrink-0 items-center rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                tab === t.id
                  ? "bg-primary text-primary-fg shadow-[var(--shadow-soft)]"
                  : "bg-card text-muted shadow-[var(--shadow-border)] hover:text-fg",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6" role="tabpanel">
          {tab === "gfr" ? <Gfr /> : null}
          {tab === "bmi" ? <Bmi /> : null}
          {tab === "chads" ? <Chads /> : null}
          {tab === "gcs" ? <Gcs /> : null}
          {tab === "qtc" ? <Qtc /> : null}
          {tab === "wells" ? <Wells /> : null}
          {tab === "curb" ? <Curb /> : null}
        </div>

        <Link
          to="/bibliotheque"
          className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-fg"
        >
          <BookOpen className="size-4" aria-hidden />
          Tous les outils dans la bibliothèque
        </Link>
      </Page>
    </Shell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Result({ value, detail }: { value: string; detail: string }) {
  return (
    <div className="optimus-card mt-5 overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-primary to-success" aria-hidden />
      <div className="p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Résultat</p>
        <p className="mt-1 font-display text-4xl font-medium tabular-nums text-primary">{value}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{detail}</p>
      </div>
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm shadow-[var(--shadow-border)] transition-colors",
        checked ? "bg-primary-soft text-fg" : "bg-card text-muted hover:text-fg",
      )}
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors",
          checked ? "border-primary bg-primary text-primary-fg" : "border-border-strong",
        )}
        aria-hidden
      >
        {checked ? <Check className="size-3.5" /> : null}
      </span>
      <span className="min-w-0 flex-1">{label}</span>
    </button>
  );
}

function Gfr() {
  const [age, setAge] = useState(68);
  const [weight, setWeight] = useState(72);
  const [crea, setCrea] = useState(112);
  const [female, setFemale] = useState(false);
  const cg = cockcroftGault({ age, weightKg: weight, creatinineUmol: crea, female });
  const epi = ckdEpi({ age, creatinineUmol: crea, female });
  return (
    <div className="space-y-3">
      <Field label="Âge (ans)">
        <Input type="number" value={age} onChange={(e) => setAge(Number(e.target.value))} />
      </Field>
      <Field label="Poids (kg)">
        <Input type="number" value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
      </Field>
      <Field label="Créatinine (µmol/L)">
        <Input type="number" value={crea} onChange={(e) => setCrea(Number(e.target.value))} />
      </Field>
      <CheckRow label="Sexe féminin" checked={female} onChange={setFemale} />
      <Result value={`${epi}`} detail={`CKD-EPI 2021 · Cockcroft-Gault ${cg} mL/min`} />
    </div>
  );
}

function Bmi() {
  const [w, setW] = useState(72);
  const [h, setH] = useState(168);
  const v = bmi(w, h);
  return (
    <div className="space-y-3">
      <Field label="Poids (kg)">
        <Input type="number" value={w} onChange={(e) => setW(Number(e.target.value))} />
      </Field>
      <Field label="Taille (cm)">
        <Input type="number" value={h} onChange={(e) => setH(Number(e.target.value))} />
      </Field>
      <Result value={`${v}`} detail={bmiClass(v)} />
    </div>
  );
}

function Chads() {
  const [flags, setFlags] = useState({
    chf: false,
    htn: true,
    age75: false,
    age65: true,
    diabetes: false,
    stroke: false,
    vascular: false,
    female: false,
  });
  const r = cha2ds2Vasc(flags);
  return (
    <div className="space-y-2">
      {(
        [
          ["chf", "Insuffisance cardiaque"],
          ["htn", "Hypertension"],
          ["age75", "Âge ≥ 75 (2 pts)"],
          ["age65", "Âge 65–74 (1 pt)"],
          ["diabetes", "Diabète"],
          ["stroke", "AVC / AIT / embolie (2 pts)"],
          ["vascular", "Atteinte vasculaire"],
          ["female", "Sexe féminin"],
        ] as const
      ).map(([k, label]) => (
        <CheckRow key={k} label={label} checked={flags[k]} onChange={(v) => setFlags({ ...flags, [k]: v })} />
      ))}
      <Result value={String(r.score)} detail={r.risk} />
    </div>
  );
}

function Gcs() {
  const [eye, setEye] = useState(4);
  const [verbal, setVerbal] = useState(5);
  const [motor, setMotor] = useState(6);
  const r = gcs(eye, verbal, motor);
  return (
    <div className="space-y-3">
      <Field label="Ouverture des yeux (1–4)">
        <Input type="number" min={1} max={4} value={eye} onChange={(e) => setEye(Number(e.target.value))} />
      </Field>
      <Field label="Réponse verbale (1–5)">
        <Input type="number" min={1} max={5} value={verbal} onChange={(e) => setVerbal(Number(e.target.value))} />
      </Field>
      <Field label="Réponse motrice (1–6)">
        <Input type="number" min={1} max={6} value={motor} onChange={(e) => setMotor(Number(e.target.value))} />
      </Field>
      <Result value={String(r.total)} detail={r.label} />
    </div>
  );
}

function Qtc() {
  const [qt, setQt] = useState(400);
  const [hr, setHr] = useState(80);
  const r = qtcBazett(qt, hr);
  return (
    <div className="space-y-3">
      <Field label="QT (ms)">
        <Input type="number" value={qt} onChange={(e) => setQt(Number(e.target.value))} />
      </Field>
      <Field label="Fréquence (bpm)">
        <Input type="number" value={hr} onChange={(e) => setHr(Number(e.target.value))} />
      </Field>
      <Result value={`${r.qtc} ms`} detail={`Bazett · ${r.label}`} />
    </div>
  );
}

function Wells() {
  const [flags, setFlags] = useState({
    signsDvt: false,
    altLessLikely: false,
    hr100: false,
    immobilization: false,
    previous: false,
    hemoptysis: false,
    malignancy: false,
  });
  const r = wellsPe(flags);
  return (
    <div className="space-y-2">
      {(
        [
          ["signsDvt", "Signes de TVP (3)"],
          ["altLessLikely", "EP plus probable que les alternatives (3)"],
          ["hr100", "FC > 100 (1,5)"],
          ["immobilization", "Alitement / chirurgie (1,5)"],
          ["previous", "TVP / EP antérieure (1,5)"],
          ["hemoptysis", "Hémoptysie (1)"],
          ["malignancy", "Cancer actif (1)"],
        ] as const
      ).map(([k, label]) => (
        <CheckRow key={k} label={label} checked={flags[k]} onChange={(v) => setFlags({ ...flags, [k]: v })} />
      ))}
      <Result value={String(r.score)} detail={r.label} />
    </div>
  );
}

function Curb() {
  const [flags, setFlags] = useState({
    confusion: false,
    urea: false,
    rr: false,
    bp: false,
    age65: false,
  });
  const r = curb65(flags);
  return (
    <div className="space-y-2">
      {(
        [
          ["confusion", "Confusion"],
          ["urea", "Urée > 7 mmol/L"],
          ["rr", "FR ≥ 30"],
          ["bp", "TA < 90/60"],
          ["age65", "Âge ≥ 65"],
        ] as const
      ).map(([k, label]) => (
        <CheckRow key={k} label={label} checked={flags[k]} onChange={(v) => setFlags({ ...flags, [k]: v })} />
      ))}
      <Result value={String(r.score)} detail={r.label} />
    </div>
  );
}
