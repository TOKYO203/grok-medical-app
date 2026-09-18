
export type KnowledgeNode = {
 id:string
 label:string
 type:
 | "symptom"
 | "disease"
 | "exam"
 | "treatment"
}


export type KnowledgeRelation = {
 from:string
 to:string
 relation:string
}


export const KNOWLEDGE_NODES:KnowledgeNode[]=[

{
 id:"fever",
 label:"Fièvre",
 type:"symptom"
},

{
 id:"cough",
 label:"Toux",
 type:"symptom"
},

{
 id:"pneumonia",
 label:"Pneumonie",
 type:"disease"
},

{
 id:"xray",
 label:"Radiographie thorax",
 type:"exam"
},

{
 id:"antibiotic",
 label:"Antibiothérapie",
 type:"treatment"
}

]


export const KNOWLEDGE_RELATIONS:KnowledgeRelation[]=[

{
 from:"fever",
 to:"pneumonia",
 relation:"symptôme associé"
},

{
 from:"cough",
 to:"pneumonia",
 relation:"symptôme associé"
},

{
 from:"pneumonia",
 to:"xray",
 relation:"examen recommandé"
},

{
 from:"pneumonia",
 to:"antibiotic",
 relation:"traitement possible"
}

]


export function findConnections(id:string){

return KNOWLEDGE_RELATIONS.filter(
 r=>r.from===id || r.to===id
)

}


