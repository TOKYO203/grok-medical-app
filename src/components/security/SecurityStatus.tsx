

import {

getPermissions

}

from "@/lib/security/security-engine"



export default function SecurityStatus(){


const data=getPermissions("user")


return (

<div className="rounded-xl border p-6">


<h2 className="text-xl font-bold">

🔐 Security Status

</h2>


<p>

Role : {data.role}

</p>


</div>

)

}


