

export type SimulationResult={

score:number
feedback:string

}


export function evaluateSimulation(
answers:number
):SimulationResult{


return {

score:Math.min(
answers*10,
100
),

feedback:
"Continuez votre raisonnement clinique."

}

}


