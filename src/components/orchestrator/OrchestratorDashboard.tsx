

import {
orchestrate
}
from "@/lib/orchestrator/orchestrator-engine"


export default function OrchestratorDashboard(){


const result=
orchestrate(
"diagnostic learning"
)


return (

<div className="rounded-xl border p-6">


<h2 className="text-xl font-bold">

🧠 Clinical Orchestrator

</h2>


<p>

Agent :

{result.assignedAgent?.name}

</p>


</div>

)


}


