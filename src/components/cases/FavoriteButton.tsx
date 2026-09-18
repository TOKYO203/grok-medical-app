import { Star } from "lucide-react";


type Props={
 active:boolean;
 onToggle:()=>void;
};


export function FavoriteButton({
 active,
 onToggle
}:Props){

return (

<button
type="button"
onClick={onToggle}
className="
flex items-center gap-2
rounded-full
px-3 py-2
text-sm
bg-card
shadow-[var(--shadow-border)]
"
>

<Star
className="size-4"
fill={active ? "currentColor":"none"}
/>

{active ? "Favori":"Ajouter"}

</button>

);

}
