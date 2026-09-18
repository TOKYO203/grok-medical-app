

import {

 OPTIMUS_SYSTEM_PROMPT

} from "./system-prompt";


import type {

 PromptContext

} from "./persona.types";



export function buildOptimizedPrompt(

context:PromptContext

){


return `

${OPTIMUS_SYSTEM_PROMPT}


Previous context:

${JSON.stringify(context.memory ?? {})}


User request:

${context.userMessage}


Generate a structured response.

`;

}

