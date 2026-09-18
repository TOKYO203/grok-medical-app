

import {

 runAI

} from "../model";


import {

 executeReasoning

} from "../reasoning";


import {

 coordinateAgent

} from "../agents";


import {

 saveMemory

} from "../memory";


import type {

 OptimusRequest,

 OptimusResponse

} from "./orchestrator.types";




export async function executeOptimus(

request:OptimusRequest

):Promise<OptimusResponse>{



const reasoning = executeReasoning({

 id:request.id,

 mode:"decision",

 input:request.message

});




const task = {

 id:request.id,

 action:"process-user-request",

 payload:reasoning

};



coordinateAgent(task);




const ai = await runAI({

 id:request.id,

 prompt:request.message

});




saveMemory({

 id:request.id,

 userId:request.userId ?? "anonymous",

 type:"conversation",

 content:request.message,

 createdAt:new Date().toISOString()

});




return {

 success:ai.success,

 answer:ai.content ?? "",

 agent:"optimus-core",

 memorySaved:true

};


}



