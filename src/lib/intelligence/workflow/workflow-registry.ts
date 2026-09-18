import type {
 IntelligenceWorkflow
} from "./workflow.types";


export const workflowRegistry:IntelligenceWorkflow[]=[];


export function registerWorkflow(
 workflow:IntelligenceWorkflow
){

 workflowRegistry.push(workflow);

 return workflow;

}


export function getWorkflows(){

 return workflowRegistry;

}
