

import {

generateCertificate

}

from "@/lib/certification/certificate-engine"


export default function CertificateCard(){


const certificate=
generateCertificate()


return (

<div className="rounded-xl border p-6">


<h2 className="text-xl font-bold">

🏅 Certificate

</h2>


<p>

{certificate.title}

</p>


<p>

{certificate.level}

</p>


</div>

)

}


