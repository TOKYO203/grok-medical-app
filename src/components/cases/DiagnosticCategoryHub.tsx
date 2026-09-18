
import {
 ChevronDown,
 ChevronRight
} from "lucide-react";

import {
 useState
} from "react";


type Props={
 categories:Record<string,any[]>;
};


const LABELS:Record<string,string>={
 cardio:"❤️ Cardiologie",
 pneumo:"🫁 Pneumologie",
 neuro:"🧠 Neurologie",
 orl:"👂 ORL",
 ophtalmo:"👁 Ophtalmologie",
 gastro:"🩺 Gastro-entérologie",
 uro:"🧬 Urologie / Néphrologie",
 gyneco:"🤰 Gynécologie / Obstétrique",
 urgence:"🚨 Urgences / Réanimation",
 autres:"📚 Autres"
};


export function DiagnosticCategoryHub({
 categories
}:Props){


const [open,setOpen]=useState<string|null>(null);


return (

<div className="mt-4 space-y-3">

{
Object.entries(categories)
.map(([id,items])=>{


const active=open===id;


return (

<section
key={id}
className="rounded-[var(--radius-xl)] bg-card shadow-[var(--shadow-border)]"
>


<button
className="flex w-full items-center justify-between p-4"
onClick={()=>setOpen(active?null:id)}
>

<span className="font-medium">
{LABELS[id] ?? id}
</span>


<span className="text-sm text-muted">
{items.length}
{
active
?
<ChevronDown className="inline ml-2 size-4"/>
:
<ChevronRight className="inline ml-2 size-4"/>
}
</span>

</button>


{
active &&

<div className="border-t border-border p-4 space-y-2">

{
items.map((item)=>(
<div
key={item.id}
className="rounded-lg bg-secondary p-3 text-sm"
>
{item.title}
</div>
))
}

</div>

}


</section>

)

})

}

</div>

)

}

