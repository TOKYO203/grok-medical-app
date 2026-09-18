

export function recommendNext(
completed:number
){

if(completed<5)

return "Découvrir les bases"


if(completed<20)

return "Approfondir les cas cliniques"


return "Mode expert"

}


