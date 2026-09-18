
export interface OptimusRequest {
  id:string;
  userId:string;
  message:string;
  mode?:
    | "clinical"
    | "research"
    | "tutor"
    | "simulation";
}


export interface OptimusResponse {

  success:boolean;

  answer:string;

  agent?:string;

  reasoning?:string;

  memorySaved?:boolean;

  error?:string;

}

