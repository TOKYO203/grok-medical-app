

export type MemoryEvent={

type:
"case" |
"lesson" |
"simulation"

id:string

score?:number

date:string

}


export function saveMemory(
event:MemoryEvent
){

return {

stored:true,

event

}

}


export function getMemoryScore(
events:MemoryEvent[]
){

return events.reduce(

(total,event)=>

total+(event.score || 0),

0

)

}


