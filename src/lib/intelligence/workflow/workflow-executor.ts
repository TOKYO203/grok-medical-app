import type {
 IntelligenceWorkflow
} from "./workflow.types";


export function executeWorkflow(
 workflow:IntelligenceWorkflow
){

 return {

  ...workflow,

  status:"completed"

 };

}
