export type WorkflowStatus =
 | "pending"
 | "running"
 | "completed"
 | "failed";


export interface WorkflowTask {

 id:string;

 name:string;

 action:string;

 status:WorkflowStatus;

 payload?:unknown;

}


export interface IntelligenceWorkflow {

 id:string;

 goal:string;

 tasks:WorkflowTask[];

 status:WorkflowStatus;

}
