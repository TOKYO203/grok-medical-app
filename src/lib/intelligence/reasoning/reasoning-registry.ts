import type {
 ReasoningMode
} from "./reasoning.types";


export interface ReasoningCapability {

 id:string;

 mode:ReasoningMode;

 description:string;

 enabled:boolean;

}


export const reasoningRegistry:ReasoningCapability[]=[

 {
  id:"differential-engine",
  mode:"diagnostic",
  description:"Clinical differential reasoning",
  enabled:true
 },

 {
  id:"evidence-engine",
  mode:"evidence",
  description:"Evidence ranking analysis",
  enabled:true
 },

 {
  id:"decision-engine",
  mode:"decision",
  description:"Clinical decision support",
  enabled:true
 }

];


export function getReasoningCapability(
 mode:ReasoningMode
){

 return reasoningRegistry.find(
  item=>item.mode===mode
 );

}
