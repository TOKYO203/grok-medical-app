

export type SimulationResult = {

score:number

correct:number

total:number

xp:number

rank:string

}



export function calculateSimulation(
correct:number,
total:number
):SimulationResult{


const score =
Math.round(
(correct / total) * 100
)



const xp =
correct * 50



let rank="Débutant"


if(score>=90)
 rank="🏆 Expert Clinique"

else if(score>=70)
 rank="🥇 Avancé"

else if(score>=50)
 rank="🥈 Intermédiaire"



return {

score,

correct,

total,

xp,

rank

}


}



export function nextDifficulty(score:number){

if(score>=85)
 return "Difficile"

if(score>=60)
 return "Moyen"

return "Facile"

}


