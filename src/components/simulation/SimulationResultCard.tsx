

import {
calculateSimulation
} from "@/lib/simulation/clinical-simulation-engine"



export default function SimulationResultCard(){


const result =
calculateSimulation(
8,
10
)


return (

<div className="rounded-xl border p-5 space-y-3">


<h2 className="text-xl font-bold">
🧪 Résultat Simulation
</h2>


<p>
Score :
<b>
{result.score}%
</b>
</p>


<p>
Rang :
<b>
{result.rank}
</b>
</p>


<p>
XP gagné :
<b>
+{result.xp}
</b>
</p>


</div>


)

}


