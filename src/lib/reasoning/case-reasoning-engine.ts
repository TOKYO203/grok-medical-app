

export type ReasoningResult={

score:number
feedback:string

}


export function evaluateReasoning(
steps:number
):ReasoningResult{


return {

score:
Math.min(
steps*20,
100
),

feedback:
steps>3
?
"Excellent raisonnement progressif"
:
"Continuez l'analyse"

}

}


