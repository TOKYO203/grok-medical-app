

export function createAuditLog(action:string){


return {

action,

timestamp:new Date().toISOString(),

success:true

}


}


