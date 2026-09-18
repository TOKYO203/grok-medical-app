

import {

 executeReasoning

} from "../reasoning";


import {

 runAI

} from "../model";


import type {

 ClinicalRequest,

 ClinicalResponse

} from "./clinical.types";





export async function runClinicalIntelligence(

 request:ClinicalRequest

):Promise<ClinicalResponse>{


try {


const reasoning = executeReasoning({

id:request.id,

mode:"diagnostic",

input:request.context

});




const ai = await runAI({

id:request.id,

prompt:

`
Clinical context:

${JSON.stringify(request.context)}

Question:

${request.question}

Provide structured clinical assistance.

`

});




return {


success:true,

reasoning,

analysis:ai.content


};



}catch(error){


return {

success:false,

error:String(error)

};


}


}

