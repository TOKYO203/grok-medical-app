

export type Permission = {

role:string

permissions:string[]

}


export function getPermissions(role:string):Permission{


if(role==="admin"){

return {

role,

permissions:[

"manage_users",
"manage_content",
"view_logs"

]

}

}


return {

role,

permissions:[

"read_content",
"complete_cases"

]

}


}


