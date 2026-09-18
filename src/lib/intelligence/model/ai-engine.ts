
import {
 OllamaClient
} from "./ollama.client";


import type {
 AIResponse,
 AIRequest
} from "./model.types";


const provider =
 new OllamaClient();



export async function runAI(
 request:AIRequest
):Promise<AIResponse>{


 try {


  const result =
   await provider.generate(
    request.prompt
   );


  return {

   success:true,

   provider:"ollama",

   content:result

  };


 } catch(error){


  return {

   success:false,

   provider:"ollama",

   error:String(error)

  };


 }


}

