

import {

expertMode

}

from "@/lib/expert/expert-mode-engine"



export default function ExpertPanel(){


const expert=expertMode()


return (

<div className="rounded-xl border p-6">

<h2 className="text-xl font-bold">

🧠 Expert Mode

</h2>


<p>

{expert.enabled
?
"Activated"
:
"Disabled"}

</p>


</div>

)

}


