export type ReasoningMode =
 | "diagnostic"
 | "evidence"
 | "decision";


export interface ReasoningRequest {

 id:string;

 mode:ReasoningMode;

 input:unknown;

}


export interface ReasoningResult {

 success:boolean;

 mode:ReasoningMode;

 output?:unknown;

 error?:string;

}
