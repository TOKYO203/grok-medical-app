
import ProfileCard
from "@/components/user/ProfileCard";

import XPProgress
from "@/components/user/XPProgress";


export default function Dashboard(){


const xp=750;


return (

<main className="p-6 space-y-6">


<h1 className="text-3xl font-bold">
Optimus Dashboard
</h1>


<ProfileCard
xp={xp}
name="Clinical User"
/>


<XPProgress
xp={xp}
/>


<section>

<h2 className="text-xl">
⭐ Favoris
</h2>

<p>
Aucun cas enregistré
</p>

</section>


<section>

<h2 className="text-xl">
📚 Historique
</h2>

<p>
Dernières consultations
</p>

</section>


</main>

)

}

