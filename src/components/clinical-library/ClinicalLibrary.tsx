

import {
getClinicalCases
}
from "@/lib/clinical-library/library-engine"


export default function ClinicalLibrary(){


const cases=getClinicalCases()


return (

<div className="rounded-xl border p-6">


<h2 className="text-xl font-bold">

📚 Clinical Library

</h2>


<p>

{cases.length} cases available

</p>


</div>

)

}

