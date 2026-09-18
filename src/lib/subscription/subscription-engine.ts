

export type Plan={

name:string

features:string[]

}


export function getPlans(){

return [

{

name:"Free",

features:[
"Basic Cases"
]

},

{

name:"Premium",

features:[
"AI Tutor",
"Simulation",
"Expert Content"
]

}

]

}


