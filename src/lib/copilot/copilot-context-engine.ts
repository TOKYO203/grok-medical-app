

export function buildCopilotContext(
caseId:string
){

return {

caseId,

context:[
"history",
"knowledge",
"simulation"
]

}

}


