

export type Certificate={

title:string

level:string

date:string

}


export function generateCertificate(){

return {

title:
"Optimus Clinical Certificate",

level:
"Advanced Clinical Learner",

date:
new Date().toISOString()

}

}


