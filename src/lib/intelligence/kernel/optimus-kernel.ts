
import { runAI } from "../model";
import { runAutonomous } from "../autonomous";
import type {
 OptimusKernelRequest,
 OptimusKernelResponse
} from "./kernel.types";


export async function executeOptimusKernel(
 request:OptimusKernelRequest
):Promise<OptimusKernelResponse>{


 try {


  const autonomous =
    await runAutonomous({
      id:request.id,
      userId:request.userId,
      message:request.message
    });



  const ai =
    await runAI({
      id:request.id,
      prompt:
      `
      You are Optimus AI core.
      Context:
      ${autonomous.answer}

      User:
      ${request.message}
      `,
    });



  return {

   success:true,

   answer:
    ai.content ??
    autonomous.answer,

   source:"optimus-kernel"

  };


 }catch(error){

  return {

   success:false,

   answer:"",

   source:"optimus-kernel",

   error:String(error)

  };

 }

}

