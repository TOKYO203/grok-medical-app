

export function clinicalAnalytics(data:number[]){

return {

total:data.length,

average:
data.length
?
data.reduce((a,b)=>a+b,0)/data.length
:
0

}

}


