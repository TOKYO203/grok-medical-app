

export type UserProfile={

id:string

name:string

level:number

xp:number

premium:boolean

}


export function createUserProfile(){

return {

id:"user-demo",

name:"Clinical User",

level:5,

xp:2500,

premium:true

}

}


