import type {
 IntelligenceWorkflow,
 WorkflowTask
} from "./workflow.types";


export function planWorkflow(
 goal:string
):IntelligenceWorkflow{


 const tasks:WorkflowTask[]=[

  {
   id:"task-1",
   name:"Analyze request",
   action:"reasoning",
   status:"pending"
  },

  {
   id:"task-2",
   name:"Execute agent",
   action:"agent",
   status:"pending"
  }

 ];


 return {

  id:crypto.randomUUID(),

  goal,

  tasks,

  status:"pending"

 };

}
