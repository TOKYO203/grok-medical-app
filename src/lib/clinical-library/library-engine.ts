

export type ClinicalCase = {

id:string

title:string

difficulty:string

specialty:string

}


export function getClinicalCases(){

return [

{
id:"case-001",
title:"Cardiology Emergency",
difficulty:"advanced",
specialty:"Cardiology"
},

{
id:"case-002",
title:"Neurology Assessment",
difficulty:"intermediate",
specialty:"Neurology"
}

]

}


