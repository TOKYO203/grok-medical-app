export interface WorkflowStep {
 id:string;
 name:string;
 status:string;
}

export interface Workflow {
 id:string;
 steps:WorkflowStep[];
}
