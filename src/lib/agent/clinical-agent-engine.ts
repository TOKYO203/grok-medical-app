
export type AgentContext={

topic:string
level:number
history:number

}


export function runClinicalAgent(
context:AgentContext
){

return {

message:
`Analyse clinique ${context.topic}`,

actions:[

"Observer les symptômes",

"Construire hypothèses",

"Vérifier diagnostic"

],

level:
context.level

}

}

