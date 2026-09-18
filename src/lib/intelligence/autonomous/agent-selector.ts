
import type {
 AutonomousAction
} from "./autonomous.types";


export function selectAgent(
 action:AutonomousAction
){

 switch(action){

 case "clinical":
  return "clinical-agent";


 case "research":
  return "research-agent";


 case "tutor":
  return "tutor-agent";


 case "simulation":
  return "simulation-agent";


 default:
  return "clinical-agent";

 }

}

