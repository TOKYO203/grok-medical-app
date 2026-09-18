

export type KnowledgeNode={

id:string

category:string

links:string[]

}


export function connectKnowledge(
node:KnowledgeNode
){

return {

node,

connections:
node.links.length

}

}


