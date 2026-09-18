
export type ClinicalProfile = {
 xp:number
 level:number
 rank:string
 completed:number
 favorites:number
}

export function clinicalRank(xp:number){

 if(xp>=5000)
 return "🏆 Clinical Master"

 if(xp>=2500)
 return "🥇 Senior Explorer"

 if(xp>=1000)
 return "🥈 Clinical Learner"

 return "🌱 Beginner"

}


export function clinicalLevel(xp:number){

 return Math.floor(xp/500)+1

}


export function buildProfile(
xp:number,
completed:number,
favorites:number
):ClinicalProfile{

return {

xp,

level:clinicalLevel(xp),

rank:clinicalRank(xp),

completed,

favorites

}

}

