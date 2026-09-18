
export type ClinicalInsight = {
 title:string
 message:string
 priority:"low"|"medium"|"high"
}


export function generateClinicalInsight(
 xp:number,
 completed:number
):ClinicalInsight{

 if(completed < 5){
  return {
   title:"Fondations cliniques",
   message:"Continuez les cas fondamentaux pour construire votre base.",
   priority:"medium"
  }
 }


 if(xp > 2000){
  return {
   title:"Niveau avancé détecté",
   message:"Passez aux diagnostics complexes.",
   priority:"high"
  }
 }


 return {
  title:"Progression stable",
  message:"Votre apprentissage clinique évolue correctement.",
  priority:"low"
 }

}

