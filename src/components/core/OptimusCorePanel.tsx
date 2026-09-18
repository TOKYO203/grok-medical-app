

import {
runClinicalPipeline
} from "@/lib/core/clinical-decision-pipeline"


export default function OptimusCorePanel(){


const result =
runClinicalPipeline(
"clinical case"
)


return (

<div className="rounded-xl border p-5">

<h2 className="text-xl font-bold">

🚀 Optimus Autonomous Core

</h2>


<p>

Agent :
{result.agent.agent}

</p>


</div>

)

}


