
type Props={
title:string;
step:number;
onResume:()=>void;
};


export function ClinicalHistoryCard({
title,
step,
onResume
}:Props){

return (

<section
className="
rounded-[var(--radius-xl)]
bg-card
p-4
shadow-[var(--shadow-border)]
"
>

<p className="font-medium">
{title}
</p>


<p className="mt-2 text-xs text-muted">
Dernière étape : {step}
</p>


<button
type="button"
onClick={onResume}
className="
mt-3
rounded-full
bg-primary
px-4 py-2
text-sm
"
>

Continuer →

</button>


</section>

);

}

