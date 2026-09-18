
export type DiagnosticCategory = {
  id: string;
  label: string;
  icon: string;
};


export const DIAGNOSTIC_CATEGORIES: DiagnosticCategory[] = [

 {
  id:"cardio",
  label:"Cardiologie",
  icon:"❤️"
 },

 {
  id:"pneumo",
  label:"Pneumologie",
  icon:"🫁"
 },

 {
  id:"neuro",
  label:"Neurologie",
  icon:"🧠"
 },

 {
  id:"orl",
  label:"ORL",
  icon:"👂"
 },

 {
  id:"ophtalmo",
  label:"Ophtalmologie",
  icon:"👁"
 },

 {
  id:"gastro",
  label:"Gastro-entérologie",
  icon:"🩺"
 },

 {
  id:"uro",
  label:"Urologie / Néphrologie",
  icon:"🧬"
 },

 {
  id:"gyneco",
  label:"Gynécologie / Obstétrique",
  icon:"🤰"
 },

 {
  id:"urgence",
  label:"Urgences / Réanimation",
  icon:"🚨"
 }

];


export function detectDiagnosticCategory(
 specialty:string
){

 const value=specialty.toLowerCase();


 if(value.includes("cardio"))
 return "cardio";

 if(value.includes("pneumo"))
 return "pneumo";

 if(value.includes("neuro"))
 return "neuro";

 if(value.includes("orl"))
 return "orl";

 if(value.includes("ophtalmo"))
 return "ophtalmo";

 if(value.includes("gastro"))
 return "gastro";

 if(value.includes("uro") || value.includes("néphro"))
 return "uro";

 if(value.includes("gyn") || value.includes("obst"))
 return "gyneco";

 if(value.includes("urgence") || value.includes("réanimation"))
 return "urgence";


 return "autres";

}


export function groupDiagnosticsByCategory(
 topics:any[]
){

 return topics.reduce(
 (acc,item)=>{

 const category=
 detectDiagnosticCategory(item.specialty ?? "");

 if(!acc[category])
 acc[category]=[];

 acc[category].push(item);

 return acc;

 },
 {} as Record<string,any[]>
 );

}

