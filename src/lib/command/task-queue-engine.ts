

export type Task={

id:string

name:string

status:
"pending"|
"running"|
"done"

}



export function createTask(
name:string
):Task{


return {

id:
Date.now().toString(),

name,

status:"pending"

}

}


