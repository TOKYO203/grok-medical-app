

export interface DiagnosticNavigationItem {

 id:string;

 title:string;

 specialty:string;

 number:number;

}



export function normalizeText(
 value:string
){

 return value
 .toLowerCase()
 .normalize("NFD")
 .replace(/[\u0300-\u036f]/g,"");

}



export function filterDiagnostics(
 topics:DiagnosticNavigationItem[],
 query:string,
 specialty?:string
){


 const q =
 normalizeText(query);



 return topics.filter(topic=>{


 const matchSearch =
 !q ||
 normalizeText(
 `${topic.title} ${topic.specialty}`
 )
 .includes(q);



 const matchSpecialty =
 !specialty ||
 topic.specialty === specialty;



 return matchSearch && matchSpecialty;


 });


}



export function extractSpecialties(
 topics:DiagnosticNavigationItem[]
){


 return Array.from(
 new Set(
 topics.map(
 topic=>topic.specialty
 )
 )
 )
 .sort();


}



export function countDiagnostics(
 topics:DiagnosticNavigationItem[]
){

 return topics.length;

}


