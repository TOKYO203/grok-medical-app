

import {
recommendNextCase
} from "@/lib/ai/recommendation-engine"


export default function SmartRecommendationCard(){

const recommendation=
recommendNextCase(3)


return (

<div className="rounded-xl border p-5">

<h3 className="font-bold">
🎯 Cas recommandé
</h3>


<p>
{recommendation.title}
</p>


<p>
+{recommendation.xp} XP
</p>


</div>

)

}

