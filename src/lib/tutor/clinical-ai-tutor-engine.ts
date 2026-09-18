

export type TutorResponse = {

hint:string

explanation:string

difficulty:string

xp:number

}



export function generateHint(
level:number
):TutorResponse{


if(level===1){

return {

hint:
"🔎 Observez les signes cliniques principaux.",

explanation:
"Commencez par identifier les symptômes dominants avant de proposer un diagnostic.",

difficulty:
"Facile",

xp:20

}

}



if(level===2){

return {

hint:
"🧠 Comparez avec les diagnostics similaires.",

explanation:
"Analysez les différences entre les hypothèses possibles.",

difficulty:
"Moyen",

xp:40

}

}



return {

hint:
"🎯 Vérifiez les critères diagnostiques majeurs.",

explanation:
"Utilisez votre raisonnement clinique complet.",

difficulty:
"Avancé",

xp:60

}


}



export function evaluateAnswer(
correct:boolean
){

return {

success:correct,

message:
correct
?
"✅ Bonne analyse clinique"
:
"❌ Revoir les éléments clés du cas",

xp:
correct ? 100 : 10

}

}



