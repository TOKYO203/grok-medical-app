
import {
 clinicalRank
} from "@/lib/user/clinical-profile-engine";


export default function ProfileCard(
{
xp=0,
name="Utilisateur"
}
){

return (

<div className="rounded-xl border p-5">

<h2 className="text-xl font-bold">
👤 {name}
</h2>


<p>
Niveau :
<b>
{clinicalRank(xp)}
</b>
</p>


<p>
XP :
<b>
{xp}
</b>
</p>


</div>

)

}

