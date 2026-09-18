

import {
buildDashboard
}
from "@/lib/dashboard/dashboard-engine"


export default function PremiumDashboard(){


const data=buildDashboard()


return (

<div className="rounded-xl border p-6">


<h1 className="text-2xl font-bold">

🚀 Optimus Premium Dashboard

</h1>


<p>
Cas terminés :
{data.casesCompleted}
</p>


<p>
Progression :
{data.learningProgress}%
</p>


</div>

)

}


