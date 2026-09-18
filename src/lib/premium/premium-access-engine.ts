

export function checkPremium(
premium:boolean
){

return {

active:premium,

features:

premium

?

[
"AI Tutor",
"Advanced Simulation",
"Clinical Analytics"
]

:

[
"Basic Learning"
]

}

}


