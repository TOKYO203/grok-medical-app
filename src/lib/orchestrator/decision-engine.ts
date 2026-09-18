

export function makeDecision(
context:any
){


return {

confidence:
context
?
0.8
:
0.2,

action:
"continue-learning"

}

}


