
import { ArrowRight, Lock, CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";


export function DiagnosticTopicCard({
title,
specialty,
status="available",
number,
routeId,
}:{
title:string;
specialty:string;
status?:string;
number?:number;
routeId?:string|null;
}){


const available=status==="available" && !!routeId;


const content=(

<div
className="
w-full
rounded-[var(--radius-xl)]
bg-card
p-4
shadow-[var(--shadow-border)]
transition
active:scale-[0.98]
"
>

<div className="flex gap-3">


<div className="
flex size-10
items-center
justify-center
rounded-full
bg-primary-soft
text-primary
font-medium
">

{number ?? "•"}

</div>


<div className="flex-1">


<div className="font-medium">
{title}
</div>


<div className="mt-1 text-xs text-muted">
{specialty}
</div>


<div className="mt-3 flex items-center gap-2 text-xs font-medium text-primary">

{
available
?
<>
<CheckCircle2 className="size-3"/>
Démarche disponible
</>
:
<>
<Lock className="size-3"/>
Premium / préparation
</>
}

</div>


</div>


<ArrowRight className="size-5 text-muted"/>


</div>

</div>

);


if(available){

return (

<Link
to="/demarche/$id"
params={{id:routeId!}}
>

{content}

</Link>

)

}


return content;


}

