
export interface OptimusKernelRequest {
  id:string;
  userId?:string;
  message:string;
}


export interface OptimusKernelResponse {
  success:boolean;
  answer:string;
  source:string;
  error?:string;
}

