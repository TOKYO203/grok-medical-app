export type LearningStage =
  | "symptom"
  | "warning"
  | "exam"
  | "hypothesis"
  | "differential"
  | "decision"
  | "followup"
  | "clinical-case";


export interface LearningStep {
  id: string;
  title: string;
  stage: LearningStage;
}


export interface ClinicalPath {
  id: string;
  title: string;
  specialty: string;
  steps: LearningStep[];
}


export function createDiagnosticPath(
  title: string,
  specialty: string,
): ClinicalPath {

  return {
    id: title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-"),

    title,

    specialty,

    steps: [
      {
        id: "symptom",
        title: "Identifier le symptôme principal",
        stage: "symptom",
      },
      {
        id: "warning",
        title: "Rechercher les signes de gravité",
        stage: "warning",
      },
      {
        id: "exam",
        title: "Choisir les examens initiaux",
        stage: "exam",
      },
      {
        id: "hypothesis",
        title: "Construire les hypothèses diagnostiques",
        stage: "hypothesis",
      },
      {
        id: "differential",
        title: "Comparer les diagnostics différentiels",
        stage: "differential",
      },
      {
        id: "decision",
        title: "Décision thérapeutique",
        stage: "decision",
      },
      {
        id: "followup",
        title: "Surveillance et évolution",
        stage: "followup",
      },
      {
        id: "clinical-case",
        title: "Application en cas clinique",
        stage: "clinical-case",
      },
    ],
  };
}


export function progressPercent(
 completed:number,
 total:number
){
 if(total===0) return 0;

 return Math.round(
  (completed / total) * 100
 );
}
