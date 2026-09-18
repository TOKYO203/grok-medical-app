

export function evaluateSimulation(
answers:number[]
){

const score =
answers.length
?
answers.reduce((a,b)=>a+b,0)/answers.length
:
0


return {

score,

level:
score>80
?
"advanced"
:
"training"

}

}


