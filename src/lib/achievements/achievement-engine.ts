

export function unlockAchievement(
xp:number
){

if(xp>=5000)

return "Clinical Master"


if(xp>=1000)

return "Clinical Explorer"


return "Beginner"


}


