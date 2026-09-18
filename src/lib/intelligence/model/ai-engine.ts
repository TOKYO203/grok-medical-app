import {
 getModelProvider
} from "./model-router";


import type {
 AIResponse,
 AIRequest
} from "./model.types";


export async function runAI(
 request:AIRequest
):Promise<AIResponse>{


 try {


 const provider =
   getModelProvider(
    request.task
   );


 const result =
   await provider.generate({

    prompt:request.prompt,

    task:request.task

   });


 return {

  success:true,

  provider:result.provider,

  content:result.content

 };


 }catch(error){


 return {

  success:false,

  provider:"unknown",

  error:String(error)

 };


 }


}
