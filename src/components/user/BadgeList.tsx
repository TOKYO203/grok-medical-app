import {getBadges} from "@/lib/gamification/badge-engine";

export default function BadgeList(
{xp}:{xp:number}
){

const badges=getBadges(xp);

return (
<div className="space-y-3">

<h2 className="text-xl font-bold">
🏅 Badges
</h2>

{
badges.map((badge)=>(
<div 
key={badge.name}
className="border rounded-xl p-3">

<span className="text-2xl">
{badge.icon}
</span>

<b>
{badge.name}
</b>

<p>
{badge.description}
</p>

</div>
))
}

</div>
)
}
