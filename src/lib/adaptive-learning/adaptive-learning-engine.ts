

export function calculateDifficulty(
score:number
){

if(score<40)

return "basic"


if(score<80)

return "intermediate"


return "advanced"


}


export function nextLearningStep(
score:number
){

return {

difficulty:
calculateDifficulty(score)

}

}


