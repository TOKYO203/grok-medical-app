

import {

getLanguage

}

from "@/lib/i18n/language-engine"



export default function LanguageSelector(){


const data=getLanguage()


return (

<div className="rounded-xl border p-4">

<h2 className="font-bold">

🌍 Language

</h2>


<p>

{data.available.join(" / ")}

</p>


</div>

)

}


