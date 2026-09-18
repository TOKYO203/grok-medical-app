

export type UserContext={

history:string[]

favorites:string[]

progress:number

}


export function mergeContext(
context:UserContext
){

return {

memorySize:
context.history.length,

progress:
context.progress

}

}


