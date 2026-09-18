

export function calculateLevel(
xp:number
){

return {

level:
Math.floor(xp/500)+1,

next:
((Math.floor(xp/500)+1)*500)

}

}


export function recommendNext(){

return [

"Réviser les diagnostics faibles",

"Faire une simulation",

"Explorer un nouveau cas"

]

}


