

import {
routeClinicalTask
}
from "@/lib/agents/agent-router"


export function orchestrate(
task:string
){


const agent=
routeClinicalTask(task)


return {

task,

assignedAgent:
agent,

timestamp:
new Date()

}


}


