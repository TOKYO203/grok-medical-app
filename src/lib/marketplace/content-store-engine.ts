

export type PremiumContent={

id:string

title:string

category:string

premium:boolean

}


export function getPremiumContent(){

return [

{
id:"content-001",
title:"Advanced Clinical Reasoning",
category:"Course",
premium:true
},

{
id:"content-002",
title:"Emergency Simulation",
category:"Simulation",
premium:true
}

]

}


