
export type AIProvider =
 | "ollama"
 | "openai"
 | "mistral"
 | "deepseek";


export interface AIRequest {
 id:string;
 prompt:string;
 model?:string;
}


export interface AIResponse {
 success:boolean;
 provider:AIProvider;
 content?:string;
 error?:string;
}

