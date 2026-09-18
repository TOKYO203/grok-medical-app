import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import {
 filterDiagnostics,
 extractSpecialties,
} from "@/lib/cases/diagnostic-navigation-engine";


type Topic = {
 id:string;
 title:string;
 specialty:string;
 number:number;
};


type Props = {
 topics:Topic[];
};


export function DiagnosticExplorer({
 topics
}:Props){


 const [query,setQuery]=useState("");

 const [specialty,setSpecialty]=
 useState<string>("");


 const specialties =
 useMemo(
 ()=>extractSpecialties(topics),
 [topics]
 );


 const results =
 useMemo(
 ()=>filterDiagnostics(
    topics,
    query,
    specialty || undefined
 ),
 [
  topics,
  query,
  specialty
 ]
 );


 return (

 <section className="mt-6">


 <div className="
 rounded-[var(--radius-xl)]
 bg-card
 p-4
 shadow-[var(--shadow-border)]
 ">


 <div className="flex gap-2 items-center">

 <Search className="size-4 text-muted"/>


 <input

 value={query}

 onChange={
 e=>setQuery(e.target.value)
 }

 placeholder="Rechercher un symptôme..."

 className="
 flex-1
 bg-transparent
 outline-none
 text-sm
 "

 />

 </div>



 <div className="mt-3 flex gap-2 overflow-x-auto">

 <button

 onClick={()=>setSpecialty("")}

 className="
 rounded-full
 bg-primary-soft
 px-3 py-1
 text-xs
 "

 >
 Toutes
 </button>


 {
 specialties.map(item=>(

 <button

 key={item}

 onClick={
 ()=>setSpecialty(item)
 }

 className="
 rounded-full
 bg-secondary
 px-3 py-1
 text-xs
 "

 >

 {item}

 </button>

 ))

 }


 </div>


 <p className="
 mt-4
 text-xs
 text-muted
 ">

 {results.length} parcours disponibles

 </p>


 </div>



 <div className="mt-4 space-y-3">


 {
 results.map(topic=>(

 <article

 key={topic.id}

 className="
 rounded-[var(--radius-xl)]
 bg-card
 p-4
 shadow-[var(--shadow-border)]
 "

 >

 <p className="text-xs text-muted">
 {topic.specialty}
 </p>


 <h3 className="font-medium mt-1">
 {topic.title}
 </h3>


 <p className="text-xs text-muted mt-2">
 Parcours clinique · 8 étapes
 </p>


 </article>

 ))

 }


 </div>


 </section>

 );

}
