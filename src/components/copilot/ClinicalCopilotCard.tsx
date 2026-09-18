

import {
buildCopilotContext
} from "@/lib/copilot/copilot-context-engine"


export default function ClinicalCopilotCard(){

const context=
buildCopilotContext("demo")


return (

<div className="rounded-xl border p-5">

<h2 className="font-bold">

🤖 Clinical Copilot

</h2>

<p>

Context :
{context.context.length}
modules

</p>

</div>

)

}


