

import {

generateHint

} from "@/lib/tutor/clinical-ai-tutor-engine"



export default function ClinicalTutorCard(){


const tutor =
generateHint(2)



return (

<div className="rounded-xl border p-5 space-y-3">


<h2 className="text-xl font-bold">

🤖 Clinical AI Tutor

</h2>


<p>

{tutor.hint}

</p>


<p className="text-sm">

{tutor.explanation}

</p>


<p>

Difficulté :

<b>
{tutor.difficulty}
</b>

</p>


<p>

XP potentiel :

<b>
+{tutor.xp}
</b>

</p>


</div>

)

}


