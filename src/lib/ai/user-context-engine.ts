

export type UserClinicalContext={

 xp:number
 level:number
 completed:number
 favorites:number

}


export function buildAIContext(
 context:UserClinicalContext
){

 return {

 learner:"clinical-user",

 profile:context,

 generatedAt:new Date()

 }

}


