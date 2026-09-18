
export interface ClinicalProgress {

 id:string;

 completedSteps:string[];

 totalSteps:number;

}


export function calculateProgress(
 progress:ClinicalProgress
){

 if(progress.totalSteps===0)
 return 0;


 return Math.round(
 (progress.completedSteps.length /
 progress.totalSteps)*100
 );

}



export function calculateXP(
 completed:number
){

 return completed * 30;

}



export function getClinicalLevel(
 xp:number
){

 if(xp>=1000)
 return "Expert";

 if(xp>=500)
 return "Avancé";

 if(xp>=200)
 return "Intermédiaire";

 return "Débutant";

}


export function badgeForXP(
 xp:number
){

 if(xp>=1000)
 return "🏆 Maître du raisonnement clinique";

 if(xp>=500)
 return "🥈 Clinicien confirmé";

 if(xp>=200)
 return "🥉 Premier raisonnement";

 return "🩺 Étudiant clinique";

}

