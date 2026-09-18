
import type {

 ContextRequest,

 OptimusContext

} from "./context.types";


export function buildContext(

 request:ContextRequest

):OptimusContext {


 return {

 userId:
 request.userId ?? "anonymous",

 profile:
 request.profile,

 memories:
 request.memories ?? [],

 clinical:
 request.clinical,

 conversation:
 request.conversation ?? [],

 createdAt:
 new Date().toISOString()

 };


}

