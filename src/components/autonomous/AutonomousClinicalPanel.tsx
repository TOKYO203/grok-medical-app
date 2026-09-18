

import {
routeAgent
} from "@/lib/autonomous/agent-router"


export default function AutonomousClinicalPanel(){


const agent=
routeAgent("learn case")


return (

<div className="rounded-xl border p-5">

<h2 className="font-bold">

🚀 Autonomous Clinical AI

</h2>

<p>
Active Agent : {agent}
</p>

</div>

)

}


