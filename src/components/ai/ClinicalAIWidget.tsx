
import {
 generateClinicalInsight
} from "@/lib/ai/clinical-ai-engine"


import {
 recommendNextCase
} from "@/lib/ai/recommendation-engine"



export default function ClinicalAIWidget(){

const insight =
generateClinicalInsight(
750,
12
)


const recommendation =
recommendNextCase(3)



return (

<div className="rounded-xl border p-5 space-y-4">


<h2 className="text-xl font-bold">
🤖 Optimus Clinical AI
</h2>


<div>

<h3 className="font-semibold">
{insight.title}
</h3>

<p>
{insight.message}
</p>

</div>



<div>

<h3 className="font-semibold">
🎯 Prochaine recommandation
</h3>

<p>
{recommendation.title}
</p>

<p>
Gain : +{recommendation.xp} XP
</p>


</div>


</div>

)

}

