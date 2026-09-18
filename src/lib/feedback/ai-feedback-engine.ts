

export function generateFeedback(
score:number
){

return {

score,

message:
score>=80
?
"Excellent progression"
:
"Continue training"

}

}


