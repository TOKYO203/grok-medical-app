import type { AgentTask } from "../agents/agent.types";
import { executeAgent } from "../agents/agent-executor";
import { executeReasoning } from "../reasoning/reasoning-engine";
import { saveMemory } from "../memory/memory-store";

export interface AutonomousRequest {
  id:string;
  userId?:string;
  message:string;
}

export interface AutonomousResponse {
  success:boolean;
  answer:string;
  agent?:string;
  error?:string;
}


export async function runAutonomous(
  request:AutonomousRequest
):Promise<AutonomousResponse>{

  try {

    const task:AgentTask = {
      id:request.id,
      action:"clinical-analysis",
      payload:request.message
    };


    const agentResult = executeAgent(task);


    const reasoning = executeReasoning({
      id:request.id,
      mode:"diagnostic",
      input:request.message
    });


    saveMemory({
      id:request.id,
      userId:request.userId ?? "anonymous",
      type:"conversation",
      content:{
        message:request.message,
        reasoning
      },
      createdAt:new Date().toISOString()
    });


    return {
      success:true,
      answer:JSON.stringify(reasoning.output ?? agentResult),
      agent:"optimus-core"
    };


  } catch(error){

    return {
      success:false,
      answer:"",
      error:String(error)
    };

  }

}
