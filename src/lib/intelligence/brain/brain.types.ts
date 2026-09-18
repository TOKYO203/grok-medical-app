
export interface BrainRequest {

 id:string;

 userId?:string;

 message:string;

}


export interface BrainResponse {

 success:boolean;

 answer?:string;

 agent?:string;

 reasoning?:string;

 memorySaved?:boolean;

 error?:string;

}

