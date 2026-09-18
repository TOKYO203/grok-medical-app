

export function nextClinicalCase(
 completed:number
){

 const cases=[

 "hypertension",

 "diabetes",

 "stroke",

 "cardiology"

 ]


 return cases[
 completed % cases.length
 ]

}


