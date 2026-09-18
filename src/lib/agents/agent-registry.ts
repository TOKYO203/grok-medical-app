

export type AgentType =
"tutor"
| "diagnostic"
| "simulation"
| "research"


export type Agent = {

id:string

name:string

type:AgentType

}


export const agents:Agent[]=[

{
id:"tutor",
name:"Clinical Tutor",
type:"tutor"
},

{
id:"diagnosis",
name:"Diagnostic Assistant",
type:"diagnostic"
},

{
id:"simulation",
name:"Simulation Coach",
type:"simulation"
},

{
id:"research",
name:"Medical Research",
type:"research"
}

]


export function getAgent(
type:AgentType
){

return agents.find(
agent=>agent.type===type
)

}


