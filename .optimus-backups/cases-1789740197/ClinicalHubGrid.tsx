
import { useState } from "react";
import { SpecialtyHubCard } from "./SpecialtyHubCard";
import { DiagnosticTopicCard } from "./DiagnosticTopicCard";


export function ClinicalHubGrid({
groups
}:{
groups:Record<string, any[]>
}){


const [selected,setSelected]=useState<string|null>(null);


if(selected){

const items=groups[selected] ?? [];


return (

<div className="space-y-3">


<button
className="text-sm text-primary"
onClick={()=>setSelected(null)}
>
← Toutes les spécialités
</button>


<div>

<h3 className="font-display text-xl font-medium">
{selected}
</h3>

<p className="text-sm text-muted">
{items.length} orientation(s)
</p>

</div>


<div className="grid gap-3">

{
items.map(item=>(

<DiagnosticTopicCard

key={item.id}

title={item.title}

specialty={item.specialty}

/>

))

}

</div>


</div>

)

}



return (

<div className="grid gap-3">


{
Object.entries(groups)
.map(([name,value])=>(

<SpecialtyHubCard

key={name}

name={name}

count={value.length}

onClick={()=>setSelected(name)}

/>

))

}


</div>

)


}

