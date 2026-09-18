
import type {

 OptimusContext,

 ContextInput

} from "./context.types";


export function buildContext(

 input:ContextInput

):OptimusContext{


 return {

 userId:
 input.userId ?? "anonymous",

 profile:
 input.profile,

 memories:
 input.memories ?? [],

 clinical:
 input.clinical,

 conversation:
 input.conversation ?? [],

 createdAt:
 new Date().toISOString()

 };


}

