

import {
agents
}
from "@/lib/agents/agent-registry"


export default function AgentSwarmPanel(){


return (

<div className="rounded-xl border p-5">

<h2 className="text-xl font-bold">

🤖 Clinical Agent Swarm

</h2>


{

agents.map(agent=>(

<p key={agent.id}>

{agent.name}

</p>

))

}


</div>

)

}


