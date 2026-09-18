
export type Hypothesis={
 name:string
 score:number
}


export function generateHypothesis(
 symptoms:string[]
):Hypothesis[]{

 return symptoms.map(
 symptom=>({
 name:symptom,
 score:0.5
 })
 )

}

