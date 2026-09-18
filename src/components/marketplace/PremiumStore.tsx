

import {
getPremiumContent
}
from "@/lib/marketplace/content-store-engine"



export default function PremiumStore(){


const items=getPremiumContent()


return (

<div className="rounded-xl border p-6">

<h2 className="text-xl font-bold">

🏪 Optimus Store

</h2>


<p>

{items.length} premium contents

</p>


</div>

)

}


