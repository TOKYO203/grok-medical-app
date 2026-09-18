export type AgentRole =
 | "clinical"
 | "research"
 | "tutor"
 | "simulation";


export interface IntelligenceAgent {
 id:string;
 role:AgentRole;
 description:string;
 enabled:boolean;
}


export interface AgentTask {
 id:string;
 action:string;
 payload?:unknown;
}


export interface AgentResult {
 success:boolean;
 agent:string;
 data?:unknown;
 error?:string;
}
