
export type SafetyLevel =
 | "safe"
 | "warning"
 | "blocked";


export interface SafetyRequest {

 id:string;

 content:string;

 context?:unknown;

}


export interface SafetyResult {

 level:SafetyLevel;

 allowed:boolean;

 reason?:string;

}

