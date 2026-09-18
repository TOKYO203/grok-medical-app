import type {
 OptimusMemory
} from "./memory.types";


const memoryStore:OptimusMemory[]=[];


export function saveMemory(
 memory:OptimusMemory
){

 memoryStore.push(memory);

 return memory;

}


export function getMemory(){

 return memoryStore;

}
