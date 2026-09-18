
import { Lock } from "lucide-react";


export function PremiumLockCard(){

return (

<section
className="
rounded-[var(--radius-xl)]
bg-card
p-5
shadow-[var(--shadow-border)]
"
>

<Lock className="size-5"/>


<h3 className="mt-3 font-medium">
Contenu Premium
</h3>


<p className="mt-2 text-sm text-muted">
Accédez aux cas complets,
corrections détaillées et parcours avancés.
</p>


</section>

);

}

