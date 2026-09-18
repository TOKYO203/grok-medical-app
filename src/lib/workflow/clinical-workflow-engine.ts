

export type WorkflowStep={

id:string

name:string

status:
"pending"|
"running"|
"completed"

}


export function createWorkflow(
name:string
){

return {

id:
Date.now().toString(),

name,

steps:[] as WorkflowStep[]

}

}


