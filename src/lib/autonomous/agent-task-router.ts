

export function routeTask(type:string){

const routes:any={

diagnostic:"diagnostic-agent",
research:"research-agent",
simulation:"simulation-agent",
tutor:"tutor-agent"

}

return routes[type] || "general-agent"

}

