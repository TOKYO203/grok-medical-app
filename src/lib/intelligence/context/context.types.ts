
export interface ContextRequest {

 userId?:string;

 profile?:unknown;

 memories?:unknown[];

 clinical?:unknown;

 conversation?:string[];

}


export interface ContextInput {

 userId?:string;

 profile?:unknown;

 memories?:unknown[];

 clinical?:unknown;

 conversation?:string[];

}


export interface OptimusContext {

 userId:string;

 profile?:unknown;

 memories:unknown[];

 clinical?:unknown;

 conversation:string[];

 timestamp:string;

 createdAt:string;

}


export interface ContextAnalysis {

 hasMemory:boolean;

 hasClinical:boolean;

 conversationLength:number;

}

