
export function rankEvidence(items:string[]){

 return items.map(
 item=>({
  evidence:item,
  confidence:0.5
 })
 )

}

