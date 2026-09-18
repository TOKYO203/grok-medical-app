

export type AgentName =
"tutor" |
"copilot" |
"simulation" |
"knowledge" |
"progress"


export function routeAgent(
intent:string
){

if(intent.includes("case"))
return "simulation"


if(intent.includes("learn"))
return "tutor"


return "copilot"

}


