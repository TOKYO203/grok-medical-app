
export type TutorResponse={
question:string
hint:string
explanation:string
}


export function generateClinicalHint(topic:string):TutorResponse{

return {

question:`Analyse du cas : ${topic}`,

hint:"Identifier les signes principaux avant conclusion",

explanation:
"Le raisonnement clinique repose sur l'observation, l'analyse et la progression étape par étape."

}

}

