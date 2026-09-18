

import {
getOptimusHealth
}
from "@/lib/system/optimus-health-engine"


import {
monitorAgents
}
from "@/lib/command/agent-monitor-engine"



export default function CommandCenter(){


const health=getOptimusHealth()

const agents=monitorAgents()


return (

<div className="rounded-xl border p-6 space-y-4">


<h1 className="text-2xl font-bold">

🚀 Optimus Command Center

</h1>


<p>

Status :
<b>{health.status}</b>

</p>


<p>

Agents actifs :
<b>{agents.length}</b>

</p>


</div>

)


}

