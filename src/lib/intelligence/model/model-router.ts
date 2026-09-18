import { OllamaClient } from "./ollama.client";

import type { ModelProvider } from "./model-provider";


const ollama =
 new OllamaClient();


export function getModelProvider(
 task?:string
):ModelProvider {


 switch(task){

  case "medical_reasoning":
    return ollama;


  case "summary":
    return ollama;


  default:
    return ollama;

 }

}
