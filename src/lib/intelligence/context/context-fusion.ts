
import type {
 OptimusContext
} from "./context.types";


export function fuseContext(
 context:OptimusContext
){


 return {

  context,

  summary:
   JSON.stringify(context)

 };


}

