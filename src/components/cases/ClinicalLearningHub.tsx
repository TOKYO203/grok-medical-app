import ClinicalAIWidget from "@/components/ai/ClinicalAIWidget";
import { DiagnosticExplorer } from "@/components/cases/DiagnosticExplorer";
import { ArrowRight } from "lucide-react";

import {
 createDiagnosticPath,
 progressPercent,
} from "@/lib/cases/learning-path-engine";


type DiagnosticTopic = {
 id:string;
 title:string;
 specialty:string;
 number:number;
};


type Props = {
 topics: DiagnosticTopic[];
};


export function ClinicalLearningHub({
 topics
}:Props){


 const groups =
 topics.reduce<Record<string, DiagnosticTopic[]>>(
 (acc, topic)=>{

 const key = topic.specialty;

 if(!acc[key]){
   acc[key]=[];
 }

 acc[key].push(topic);

 return acc;

 },{});


 return (

 <section className="mt-8">

<DiagnosticExplorer
 topics={topics}
/>



 <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
 Learning Path
 </p>

 <h2 className="mt-1 font-display text-xl font-medium">
 Parcours diagnostiques
 </h2>


 <div className="mt-4 space-y-3">

 {
 Object.entries(groups).map(
 ([specialty,list])=>(

 <div
 key={specialty}
 className="
 rounded-[var(--radius-xl)]
 bg-card
 p-4
 shadow-[var(--shadow-border)]
 "
 >

 <h3 className="font-medium">
 {specialty}
 </h3>


 <div className="mt-3 space-y-2">

 {
 list.map(topic=>{

 const path =
 createDiagnosticPath(
 topic.title,
 topic.specialty
 );


 return (

 <div
 key={topic.id}
 className="
 flex items-center gap-3
 rounded-lg
 bg-secondary
 p-3
 "
 >

 <span
 className="
 flex size-8
 items-center justify-center
 rounded-full
 bg-primary-soft
 text-primary
 text-xs
 "
 >
 {topic.number}
 </span>


 <div className="flex-1">

 <p className="text-sm font-medium">
 {topic.title}
 </p>


 <p className="text-xs text-muted">
 {path.steps.length} étapes · {progressPercent(0,path.steps.length)}%
 </p>

 <ClinicalAIWidget />
</div>


 <ArrowRight className="size-4 text-primary"/>


 </div>

 );

 })

 }

 </div>


 </div>

 ))

 }

 </div>


 </section>

 );

}