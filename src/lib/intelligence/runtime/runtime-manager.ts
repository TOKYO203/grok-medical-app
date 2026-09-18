
import {
 checkOllamaRuntime
} from "./ollama-runtime";


export async function getAIRuntime(){

 const ollama =
 await checkOllamaRuntime();


 return {

 primary:ollama,

 available:
 ollama.status==="online"

 };


}

