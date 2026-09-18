

import {
getAgent,
AgentType
}
from "./agent-registry"


export function routeClinicalTask(
task:string
){

const value=
task.toLowerCase()


let type:AgentType="tutor"


if(value.includes("diagnostic"))
type="diagnostic"


if(value.includes("simulation"))
type="simulation"


if(value.includes("research"))
type="research"


return getAgent(type)

}


