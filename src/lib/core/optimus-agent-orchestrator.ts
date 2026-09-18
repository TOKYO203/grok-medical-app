

export type OptimusAgent =
| "knowledge"
| "tutor"
| "simulation"
| "copilot"
| "reasoning"


export function selectAgent(
task:string
):OptimusAgent {


const value =
task.toLowerCase()


if(value.includes("case"))
return "simulation"


if(value.includes("question"))
return "tutor"


if(value.includes("diagnostic"))
return "reasoning"


if(value.includes("search"))
return "knowledge"


return "copilot"

}



export function executeAgent(
task:string
){

return {

agent:selectAgent(task),

task,

timestamp:
new Date().toISOString()

}

}


