
import type {

 OptimusContext

} from "./context.types";


export function analyzeContext(

 context:OptimusContext

){

 return {

 hasMemory:
 (context.memories?.length ?? 0)>0,

 hasClinicalData:
 !!context.clinical,

 conversationLength:
 context.conversation?.length ?? 0

 };


}

