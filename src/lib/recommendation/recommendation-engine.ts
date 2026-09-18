

export function recommendNextStep(
score:number
){


if(score<50)

return "Review fundamentals"


if(score<80)

return "Practice clinical cases"


return "Advanced simulation"


}


