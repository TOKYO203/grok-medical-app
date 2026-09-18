
export interface ClinicalPatientContext {

 id:string;

 patientId:string;

 age?:number;

 conditions?:string[];

 symptoms?:string[];

 history?:unknown;

}


export interface ClinicalRequest {

 id:string;

 context:ClinicalPatientContext;

 question:string;

}


export interface ClinicalResponse {

 success:boolean;

 analysis?:unknown;

 reasoning?:unknown;

 error?:string;

}

