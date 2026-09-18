export const XP_ACTIONS = {
  READ_CASE: 10,
  SOLVE_CASE: 50,
  COMPLETE_QUIZ: 20,
  PREMIUM_CASE: 100,
  DAILY_STREAK: 200,
};

export function calculateXP(
  actions:number[]
){
  return actions.reduce(
    (total,xp)=>total+xp,
    0
  );
}
