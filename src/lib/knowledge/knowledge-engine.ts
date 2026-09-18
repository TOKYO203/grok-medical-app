
export type KnowledgeNode={
id:string
label:string
type:string
}


export const KNOWLEDGE_NODES:KnowledgeNode[]=[

{
id:"cardio",
label:"Cardiologie",
type:"specialty"
},

{
id:"neuro",
label:"Neurologie",
type:"specialty"
},

{
id:"infect",
label:"Infectiologie",
type:"domain"
}

]


export function getRelatedNodes(id:string){

return KNOWLEDGE_NODES.filter(
n=>n.id!==id
)

}

