

export type ClinicalContext={

caseId?:string

level:string

progress:number

}


export function buildClinicalContext(
ctx:ClinicalContext
){

return {

...ctx,

ready:true

}

}


