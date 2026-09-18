
import {
 executeReasoning
} from "../reasoning";


import {
 routeAgent
} from "../agents";


import {
 runAI
} from "../model";


import {
 saveMemory
} from "../memory";


import type {
 OptimusRequest,
 OptimusResponse
} from "./master.types";



export async function runOptimus(
 request:OptimusRequest
):Promise<OptimusResponse>{


try{


const agent =
 routeAgent(
  request.mode ?? "clinical"
 );


const reasoning =
 executeReasoning({

 id:request.id,

 mode:"decision",

 input:request.message

 });



const ai =
 await runAI({

 id:request.id,

 prompt:request.message

 });



saveMemory({

 id:crypto.randomUUID(),

 userId:request.userId,

 type:"conversation",

 content:request.message,

 createdAt:new Date().toISOString()

});



return {

 success:true,

 answer:
  ai.content ??
  "No response",

 agent:
  agent?.id,

 reasoning:
  JSON.stringify(reasoning),

 memorySaved:true

};


}catch(error){


return {

 success:false,

 answer:"",

 error:String(error)

};


}


}

