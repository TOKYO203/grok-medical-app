import type {
 AgentTask
} from "./agent.types";


export function coordinateAgent(
 task:AgentTask
){

 return {
  task,
  status:"queued"
 };

}
