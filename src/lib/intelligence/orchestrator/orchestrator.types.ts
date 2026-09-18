
export interface OptimusRequest {

 id:string;

 message:string;

 userId?:string;

}


export interface OptimusResponse {

 memorySaved?:boolean;

 success:boolean;

 answer?:string;

 agent?:string;

 reasoning?:string;

 memory?:boolean;

 error?:string;

}

