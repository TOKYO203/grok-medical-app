

import {

 buildMemoryContext

} from "./memory-context";


import {

 runAI

} from "../model";


import {

 validateSafety

} from "../safety";


import {

 saveMemory

} from "../memory";



import type {

 FusionRequest

} from "./fusion.types";






export async function runFusion(

request:FusionRequest

){



const safety = validateSafety({

id:request.id,

content:request.message

});



if(!safety.allowed){

return {

success:false,

error:safety.reason

};

}





const context = buildMemoryContext(

request

);





const response = await runAI({

id:request.id,

prompt:

`

Previous memory:

${JSON.stringify(context.memories)}

Current request:

${request.message}

Use previous context when useful.

`

});





saveMemory({

id:request.id,

userId:request.userId,

type:"conversation",

content:response.content,

createdAt:new Date().toISOString()

});





return {


success:true,

context,

answer:response.content


};


}

