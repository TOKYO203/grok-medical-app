
import {
 KNOWLEDGE_NODES,
 findConnections
} from "@/lib/knowledge/clinical-knowledge-engine"


export default function KnowledgeExplorer(){

return (

<div className="rounded-xl border p-5 space-y-4">

<h2 className="text-2xl font-bold">
🧠 Clinical Knowledge Explorer
</h2>


{
KNOWLEDGE_NODES.map(node=>{

const relations=findConnections(node.id)

return (

<div
key={node.id}
className="rounded-lg border p-3"
>

<h3 className="font-bold">
{node.label}
</h3>


<p>
Type : {node.type}
</p>


<p>
Connexions :
{relations.length}
</p>


</div>

)

})
}


</div>

)

}

