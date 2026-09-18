import type {
 ModelProvider
} from "./model-provider";

import type {
 ModelRequest
} from "./model-request";

import type {
 ModelResponse
} from "./model-response";


export class OllamaClient implements ModelProvider {


 name="ollama" as const;


 async generate(
  request:ModelRequest
 ):Promise<ModelResponse>{


  const start =
   Date.now();


  const response =
   await fetch(
    "http://localhost:11434/api/generate",
    {
     method:"POST",
     headers:{
      "Content-Type":"application/json"
     },
     body:JSON.stringify({

      model:"deepseek-coder",

      prompt:request.prompt,

      temperature:
       request.temperature ?? 0.2,

      stream:false

     })
    }
   );


  if(!response.ok){
   throw new Error(
    "Ollama error "+response.status
   );
  }


  const data =
   await response.json();


  return {

   content:
    data.response ?? "",

   provider:
    this.name,

   latency:
    Date.now()-start

  };


 }

}
