

import {
runClinicalAgent
} from "@/lib/agents/clinical-agent-orchestrator"


export default function OptimusCommandCenter(){


const status=
runClinicalAgent({

agent:"tutor",

action:"health-check"

})


return (

<div className="rounded-xl border p-5">

<h2 className="text-xl font-bold">

🚀 Optimus Command Center

</h2>


<p>

Agent :
{status.agent}

</p>


<p>

Status :
{status.status}

</p>


</div>

)

}


