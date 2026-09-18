

export type JourneyStep={

id:string

completed:boolean

}


export function calculateJourney(
steps:JourneyStep[]
){

return {

completed:
steps.filter(s=>s.completed).length,

total:
steps.length

}

}


