

export function navigateClinicalPath(
level:string
){

switch(level){

case "beginner":
return "basic-cases"

case "advanced":
return "complex-cases"

default:
return "clinical-explorer"

}

}


