

export function calculateDifficulty(
 errors:number,
 success:number
){

 const ratio =
 success / Math.max(success + errors,1)


 if(ratio > 0.85)
 return "advanced"


 if(ratio > 0.60)
 return "intermediate"


 return "basic"

}


