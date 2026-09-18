export type AgentRole =
 | "clinical"
 | "research"
 | "tutor"
 | "simulation";

export interface OptimusAgent {
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
