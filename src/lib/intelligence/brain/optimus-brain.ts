

import {

executeOptimus

} from "../orchestrator";


import {

OPTIMUS_SYSTEM_PROMPT

} from "../personality";


import type {

BrainRequest,

BrainResponse

} from "./brain.types";




export async function runOptimusBrain(

request:BrainRequest

):Promise<BrainResponse>{


const result = await executeOptimus({

id:request.id,

userId:request.userId ?? "anonymous",

message:

OPTIMUS_SYSTEM_PROMPT +

"\n\nUser request:\n" +

request.message

});



return {

success:result.success,

answer:result.answer

};


}

