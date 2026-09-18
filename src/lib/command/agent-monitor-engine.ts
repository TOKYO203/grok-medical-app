

import {
agents
}
from "@/lib/agents/agent-registry"


export function monitorAgents(){

return agents.map(agent=>({

...agent,

status:"ready"

}))

}


