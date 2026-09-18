
export type OptimusMode =
 | "clinical"
 | "assistant"
 | "research"
 | "education";


export interface OptimusPersona {

 name:string;

 role:string;

 mode:OptimusMode;

 principles:string[];

}


export interface PromptContext {

 userMessage:string;

 memory?:unknown;

}


