

export type ClinicalAgent =

"tutor" |
"simulation" |
"knowledge" |
"progress"


export type AgentTask = {

agent:ClinicalAgent

action:string

payload?:unknown

}



export function runClinicalAgent(
task:AgentTask
){

return {

agent:task.agent,

status:"ready",

action:task.action

}

}


