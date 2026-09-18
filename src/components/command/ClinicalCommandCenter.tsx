
import {
runClinicalAgent
}
from "@/lib/agent/clinical-agent-engine"


export default function ClinicalCommandCenter(){

const agent=
runClinicalAgent({

topic:"Diagnostic général",

level:3,

history:10

})


return (

<div className="rounded-xl border p-6 space-y-4">

<h2 className="text-2xl font-bold">

🧠 Clinical AI Command Center

</h2>


<p>

{agent.message}

</p>


<ul>

{
agent.actions.map(
a=>(

<li key={a}>
✅ {a}
</li>

)
)

}

</ul>


</div>

)

}

