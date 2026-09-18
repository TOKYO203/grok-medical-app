

export type AgentTask={
 agent:string
 task:string
}


export function coordinateAgent(
 task:AgentTask
){

 return {
 status:"assigned",
 ...task
 }

}

