import type {
 IntelligenceAgent
} from "./agent.types";


export const agentRegistry:IntelligenceAgent[] = [

 {
  id:"clinical-agent",
  role:"clinical",
  description:"Clinical reasoning assistant",
  enabled:true
 },

 {
  id:"research-agent",
  role:"research",
  description:"Medical research assistant",
  enabled:true
 },

 {
  id:"tutor-agent",
  role:"tutor",
  description:"Learning assistant",
  enabled:true
 }

];


export function getAgent(id:string){

 return agentRegistry.find(
  agent=>agent.id===id
 );

}
