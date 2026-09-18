
import {
  executeReasoning
} from "../reasoning";

import {
  executeAgent
} from "../agents";

import {
  saveMemory
} from "../memory";


import {
  runAI
} from "../model";


export interface OptimusInput {

  userId?:string;

  message:string;

}


export interface OptimusOutput {

  success:boolean;

  response:string;

  reasoning?:unknown;

}



export async function runOptimus(

 input:OptimusInput

):Promise<OptimusOutput>{


 const userId =
 input.userId ?? "anonymous";


 const reasoning =
 executeReasoning({

  id:Date.now().toString(),

  mode:"decision",

  input:input.message

 });



 saveMemory({

  id:Date.now().toString(),

  userId,

  type:"conversation",

  content:input.message,

  createdAt:new Date().toISOString()

 });



 const ai =
 await runAI({

  id:Date.now().toString(),

  prompt:input.message

 });



 return {

  success:true,

  response:
   ai.content ??
   "Optimus completed.",

  reasoning

 };


}

