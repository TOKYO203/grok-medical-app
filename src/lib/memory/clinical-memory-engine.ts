

export type MemoryEvent={

type:string

value:string

date:string

}


export function saveClinicalMemory(
event:MemoryEvent
){

return {

stored:true,

event

}

}


export function getClinicalMemory(){

return []

}


