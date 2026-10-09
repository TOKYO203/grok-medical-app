export type Badge = {
 name:string;
 description:string;
 icon:string;
}

export function getBadges(xp:number):Badge[]{

 const badges:Badge[]=[];

 // Premier pas : débloqué dès la première visite (0 XP requis)
 badges.push({
  name:"Premier pas",
  description:"Bienvenue — ta première carte est là.",
  icon:"👋"
 });


 if(xp>=100)
 badges.push({
  name:"First Diagnosis",
  description:"Premier parcours clinique terminé",
  icon:"🩺"
 });

 if(xp>=1000)
 badges.push({
  name:"Clinical Explorer",
  description:"Exploration clinique avancée",
  icon:"🔬"
 });

 if(xp>=5000)
 badges.push({
  name:"Clinical Expert",
  description:"Grande expérience clinique",
  icon:"🏆"
 });

 return badges;
}
