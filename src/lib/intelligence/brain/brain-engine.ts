

import {
 routeAgent
} from "../agents";


import {
 executeAgent
} from "../agents";


import {
 runAI
} from "../model";


import {
 saveMemory
} from "../memory";



import type {
 BrainRequest,
 BrainResponse
} from "./brain.types";





export async function runOptimusBrain(

 request:BrainRequest

):Promise<BrainResponse>{



try {



const agent =
 routeAgent("clinical");



const agentResult =
 executeAgent({

  id:request.id,

  action:"analyze",

  payload:request.message

 });



const ai =
 await runAI({

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


 success:true,


 agent:agent?.id,


 answer:ai.content ?? JSON.stringify(agentResult)


};



}catch(error){


return {


 success:false,

 error:String(error)


};


}


}

