import {
 calculateProgress,
 calculateXP,
 badgeForXP,
} from "@/lib/cases/progress-engine";


type Props = {
 title:string;
 completed:number;
 total:number;
};


export function ClinicalProgressCard({
 title,
 completed,
 total,
}:Props){


 const percent =
 calculateProgress({
  id:title,
  completedSteps:
   Array.from({length:completed}),
  totalSteps:total,
 });


 const xp =
 calculateXP(completed);


 return (

 <div
 className="
 rounded-[var(--radius-xl)]
 bg-card
 p-4
 shadow-[var(--shadow-border)]
 "
 >

 <h3 className="font-medium">
 {title}
 </h3>


 <div className="mt-3">

 <div
 className="
 h-2
 rounded-full
 bg-secondary
 overflow-hidden
 "
 >

 <div
 className="
 h-full
 bg-primary
 "
 style={{
 width:`${percent}%`
 }}
 />

 </div>


 <p className="mt-2 text-xs text-muted">
 {completed}/{total} étapes · {percent}%
 </p>


 <p className="mt-1 text-xs text-primary">
 +{xp} XP
 </p>


 <p className="mt-2 text-xs">
 {badgeForXP(xp)}
 </p>


 </div>


 </div>

 );

}
