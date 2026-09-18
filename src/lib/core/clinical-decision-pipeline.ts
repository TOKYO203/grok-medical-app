

import {
executeAgent
} from "./optimus-agent-orchestrator"


export function runClinicalPipeline(
input:string
){

const agent=
executeAgent(input)


return {

status:"processed",

agent

}

}


