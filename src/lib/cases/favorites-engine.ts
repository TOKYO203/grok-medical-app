
export type FavoriteItem = {
 id:string;
 createdAt:number;
};


export function addFavorite(
 list:FavoriteItem[],
 id:string
){

 if(list.some(x=>x.id===id))
 return list;

 return [
  ...list,
  {
   id,
   createdAt:Date.now()
  }
 ];

}


export function removeFavorite(
 list:FavoriteItem[],
 id:string
){

 return list.filter(
 x=>x.id!==id
 );

}

