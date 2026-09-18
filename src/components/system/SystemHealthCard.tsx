
import {
 platformHealth
} from "@/lib/core/health/platform-health-engine"


export default function SystemHealthCard(){

const health=platformHealth()

return (

<div className="rounded-xl border p-5">

<h2 className="font-bold">
🚀 Optimus Health
</h2>

<p>
Status:
{health.status}
</p>

<p>
Score:
{health.score}/100
</p>

</div>

)

}

