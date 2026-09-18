
import type {
 ModelProvider
} from "./model-provider";


export class OllamaClient implements ModelProvider {


 name="ollama" as const;


 async generate(
  prompt:string
 ){

  const response = await fetch(
   "http://localhost:11434/api/generate",
   {
    method:"POST",
    headers:{
     "Content-Type":"application/json"
    },
    body:JSON.stringify({
     model:"deepseek-coder",
     prompt,
     stream:false
    })
   }
  );


  const data = await response.json();


  return data.response ?? "";

 }

}

