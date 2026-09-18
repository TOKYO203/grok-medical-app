
export type Recommendation = {
 id:string
 title:string
 reason:string
 xp:number
}


export function recommendNextCase(
 level:number
):Recommendation{


 if(level >= 5){

 return {
  id:"stroke-advanced",
  title:"AVC ischémique avancé",
  reason:"Votre niveau permet une simulation complexe",
  xp:200
 }

 }


 return {

 id:"basic-cardiology",
 title:"Introduction Cardiologie",
 reason:"Renforcement des bases",
 xp:100

 }

}


