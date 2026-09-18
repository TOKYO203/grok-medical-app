

export interface SafetyAudit {


id:string;

timestamp:string;

level:string;

action:string;


}



const logs:SafetyAudit[]=[];



export function addSafetyLog(

log:SafetyAudit

){

logs.push(log);

}



export function getSafetyLogs(){

return logs;

}

