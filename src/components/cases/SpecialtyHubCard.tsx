
import { ChevronRight, Stethoscope } from "lucide-react";

export function SpecialtyHubCard({
 name,
 count,
 onClick,
}:{
 name:string;
 count:number;
 onClick?:()=>void;
}){

return (

<button
type="button"
onClick={onClick}
className="
w-full
flex
items-center
gap-4
rounded-[var(--radius-xl)]
bg-card
p-4
shadow-[var(--shadow-border)]
transition
active:scale-[0.98]
text-left
"
>

<span className="
flex
size-12
items-center
justify-center
rounded-full
bg-primary-soft
text-primary
">

<Stethoscope className="size-6"/>

</span>


<span className="flex-1">

<span className="block font-medium">
{name}
</span>

<span className="text-sm text-muted">
{count} orientation{count>1?"s":""}
</span>

</span>


<ChevronRight className="size-5 text-muted"/>

</button>

)

}

