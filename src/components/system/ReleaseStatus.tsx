

import {

releaseVersion

}

from "@/lib/release/version-engine"



export default function ReleaseStatus(){


const release=releaseVersion()


return (

<div className="rounded-xl border p-5">


<h2 className="font-bold text-xl">

🚀 Release Status

</h2>


<p>

{release.codename}

</p>


<p>

Version {release.version}

</p>


</div>

)

}


