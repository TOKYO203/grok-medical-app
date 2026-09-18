

import type {

 SafetyRequest,

 SafetyResult

} from "./safety.types";




const blockedPatterns=[

 "prescribe",

 "replace doctor",

 "guaranteed cure"

];





export function validateSafety(

 request:SafetyRequest

):SafetyResult{


const content =
 request.content.toLowerCase();



const blocked =
 blockedPatterns.some(

 word=>content.includes(word)

 );




if(blocked){


return {


level:"blocked",

allowed:false,

reason:

"Request requires professional medical validation"


};


}





return {


level:"safe",

allowed:true


};


}

