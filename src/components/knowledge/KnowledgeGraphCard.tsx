
import {
 KnowledgeNode,
 findConnections
} from "@/lib/knowledge/clinical-knowledge-engine"


export default function KnowledgeGraphCard(
{
node
}:{node:KnowledgeNode}
){

const links=findConnections(node.id)

return (

<div className="rounded-xl border p-5 space-y-3">

<h2 className="font-bold text-xl">
🧠 {node.label}
</h2>


<p>
Type :
<b>
{node.type}
</b>
</p>


<div>

Relations :

{
links.map((l,i)=>(

<p key={i}>
➡️ {l.relation}
</p>

))
}

</div>


</div>

)

}

