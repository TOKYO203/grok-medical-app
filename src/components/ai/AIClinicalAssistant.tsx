
import {
generateClinicalInsight
} from "@/lib/ai/clinical-ai-engine"


export default function AIClinicalAssistant(){

const insight=
generateClinicalInsight(750,12)


return (

<div className="rounded-xl border p-5 space-y-2">

<h2 className="text-xl font-bold">
🤖 Optimus AI Insight
</h2>


<p>
{insight.title}
</p>


<p>
{insight.message}
</p>


</div>

)

}

