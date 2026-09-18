
import type {
 AIRuntimeStatus
} from "./runtime.types";


export async function checkOllamaRuntime()
:Promise<AIRuntimeStatus>{


 try {


 const response =
 await fetch(
 "http://localhost:11434/api/tags"
 );


 if(!response.ok){

 return {

 provider:"ollama",

 status:"offline",

 message:"Ollama unavailable"

 };

 }



 const data =
 await response.json();



 return {

 provider:"ollama",

 status:"online",

 model:
 data.models?.[0]?.name,

 message:
 "Local AI runtime ready"

 };


 }catch(error){


 return {

 provider:"ollama",

 status:"offline",

 message:String(error)

 };


 }


}

