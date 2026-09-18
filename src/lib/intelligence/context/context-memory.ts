
import {
 retrieveMemory
} from "../memory";


export function loadUserMemory(
 userId:string
){

 return retrieveMemory(userId);

}

