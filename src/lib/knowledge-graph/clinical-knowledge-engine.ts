

export type KnowledgeNode = {

id:string

type:string

label:string

}



export function connectKnowledge(
nodes:KnowledgeNode[]
){

return {

nodes,

connections:nodes.length

}

}


