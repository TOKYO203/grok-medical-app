

export type AccessLevel =
 "free" |
 "preview" |
 "premium";


export function canAccess(
 level:AccessLevel,
 required:AccessLevel
){

 const rank={
  free:0,
  preview:1,
  premium:2
 };


 return rank[level]>=rank[required];

}


export function lockMessage(
 required:AccessLevel
){

 if(required==="premium")
 return "Contenu Premium requis";

 if(required==="preview")
 return "Aperçu disponible";

 return "Accès libre";

}

