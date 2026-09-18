

import {
getMemoryScore,
MemoryEvent
} from "@/lib/memory/clinical-memory-engine"


export function buildReasoningContext(
events:MemoryEvent[]
){

return {

experience:
getMemoryScore(events),

confidence:
events.length>0
?
"learning"
:
"new"

}

}


