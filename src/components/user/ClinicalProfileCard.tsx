
import {
useClinicalProfile
} from "@/hooks/user/useClinicalProfile"


export default function ClinicalProfileCard(){

const profile=useClinicalProfile()


return (

<div className="rounded-xl border p-5 space-y-3">

<h2 className="text-xl font-bold">
👤 Profil Clinique
</h2>

<p>
Niveau :
<b>{profile.level}</b>
</p>


<p>
Grade :
<b>{profile.rank}</b>
</p>


<p>
XP :
<b>{profile.xp}</b>
</p>


<p>
Cas terminés :
<b>{profile.completed}</b>
</p>


</div>

)

}

