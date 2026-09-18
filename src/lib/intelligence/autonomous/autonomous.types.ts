
export type AutonomousAction =
 | "clinical"
 | "research"
 | "tutor"
 | "simulation";


export interface AutonomousRequest {

 userId:string;

 input:string;

 action:AutonomousAction;

}



export interface AutonomousResult {

 success:boolean;

 agent:string;

 reasoning:string;

 answer:string;

}

