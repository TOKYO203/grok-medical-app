

import {

 retrieveMemory

} from "../memory";


import type {

 FusionRequest

} from "./fusion.types";




export function buildMemoryContext(

request:FusionRequest

){


const memories = retrieveMemory(

request.userId

);



return {


memories,

message:request.message


};


}

