
export type ClinicalHistory = {
 id:string;
 lastStep:number;
 updatedAt:number;
};


export function updateHistory(
 history:ClinicalHistory[],
 item:ClinicalHistory
){

 const filtered =
 history.filter(
 h=>h.id!==item.id
 );


 return [
  item,
  ...filtered
 ];

}


export function resumeStep(
 history:ClinicalHistory[],
 id:string
){

 return history.find(
 h=>h.id===id
 )?.lastStep ?? 0;

}

