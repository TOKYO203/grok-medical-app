import {
 getAgent
} from "./agent-registry";


export function routeAgent(role:string){

 return getAgent(
  role+"-agent"
 );

}
