import {
 getReasoningCapability
} from "./reasoning-registry";


import type {
 ReasoningMode
} from "./reasoning.types";


export function routeReasoning(
 mode:ReasoningMode
){

 return getReasoningCapability(mode);

}
