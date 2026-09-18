import {
 getMemory
} from "./memory-store";


export function retrieveMemory(
 userId:string
){

 return getMemory()
 .filter(
  item=>item.userId===userId
 );

}
