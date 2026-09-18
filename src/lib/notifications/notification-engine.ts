

export type Notification={

title:string

read:boolean

}


export function getNotifications(){

return [

{

title:
"New clinical case available",

read:false

},

{

title:
"Learning path updated",

read:false

}

]

}


