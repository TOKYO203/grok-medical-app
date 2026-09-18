
import { CheckCircle2 } from "lucide-react";


export function DiagnosticTimeline({
steps,
current
}:{
steps:string[];
current:number;
}){


return (

<div className="space-y-3">

{
steps.map((step,index)=>{

const done=index < current;
const active=index === current;


return (

<div
key={index}
className={`
flex gap-3 rounded-[var(--radius-lg)]
p-3 shadow-[var(--shadow-border)]
${active ? "bg-primary-soft" : "bg-card"}
`}
>


<div className="
flex size-8
items-center
justify-center
rounded-full
bg-primary-soft
text-primary
">

{
done
?
<CheckCircle2 className="size-4"/>
:
index+1
}

</div>


<div>

<div className="font-medium">
{step}
</div>


<div className="text-xs text-muted">

{
done
?
"Terminé"
:
active
?
"En cours"
:
"À venir"
}

</div>


</div>


</div>

)

})

}

</div>

)

}

