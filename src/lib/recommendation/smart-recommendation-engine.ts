

export function recommendNext(
completed:number
){

if(completed<10)

return "Starter Clinical Path"


if(completed<50)

return "Intermediate Cases"


return "Expert Simulation"

}


