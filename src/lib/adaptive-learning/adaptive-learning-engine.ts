

export function calculateDifficulty(
score:number
){

if(score>=90)
return "expert"


if(score>=70)
return "advanced"


if(score>=40)
return "intermediate"


return "beginner"

}


