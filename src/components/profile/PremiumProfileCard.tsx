

import {
createUserProfile
}
from "@/lib/profile/user-profile-engine"


export default function PremiumProfileCard(){


const user=createUserProfile()


return (

<div className="rounded-xl border p-6 space-y-3">

<h2 className="text-xl font-bold">

👤 {user.name}

</h2>


<p>
XP : {user.xp}
</p>


<p>
Niveau : {user.level}
</p>


<p>
⭐ Premium : {user.premium ? "ACTIVE":"OFF"}
</p>


</div>

)


}


