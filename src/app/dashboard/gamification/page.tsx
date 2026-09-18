import BadgeCard from "@/components/gamification/BadgeCard";
import DailyGoal from "@/components/gamification/DailyGoal";
import StreakCounter from "@/components/gamification/StreakCounter";

import {
 unlockBadges,
 calculateLevel
}
from "@/lib/gamification-engine";


export default function Gamification(){

const progress={
xp:2500,
casesSolved:15,
daysActive:10
};


const badges=unlockBadges(progress);


return (

<main className="p-6 space-y-6">

<h1 className="text-3xl font-bold">
🏆 Clinical Progress
</h1>


<div className="border rounded-xl p-4">

XP : {progress.xp}

<br/>

Level :
{
calculateLevel(progress.xp)
}

</div>


<StreakCounter days={progress.daysActive}/>


<DailyGoal/>


<section>

<h2>
🏅 Badges obtenus
</h2>


<div className="grid gap-3">

{
badges.map(
(b,i)=>
<BadgeCard
key={i}
badge={b}
/>
)
}

</div>


</section>


</main>

)

}
