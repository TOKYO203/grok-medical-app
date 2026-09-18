export interface UserProgress {
  xp:number;
  casesSolved:number;
  daysActive:number;
}

export function calculateLevel(xp:number){

  if(xp < 500)
    return "Beginner";

  if(xp < 1500)
    return "Clinical Explorer";

  if(xp < 3000)
    return "Medical Analyst";

  return "Clinical Expert";
}


export function unlockBadges(progress:UserProgress){

  const badges:string[]=[];

  if(progress.casesSolved>=10)
    badges.push("🩺 First Diagnoses");

  if(progress.daysActive>=7)
    badges.push("🔥 Weekly Streak");

  if(progress.xp>=2000)
    badges.push("🏆 Clinical Master");

  return badges;
}
