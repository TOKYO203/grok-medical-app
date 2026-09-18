
export type RuntimeStatus =
 | "online"
 | "offline"
 | "unknown";


export interface AIRuntimeStatus {

 provider:string;

 status:RuntimeStatus;

 model?:string;

 message:string;

}

