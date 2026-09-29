export type GoalStep={id:string;profile_id:string;team:string;week:number;due_on:string;activity:string;target:number;actual:number;note:string}
export type PerformanceGoal={id:string;title:string;metric:string;target:number;period:string;status:'DRAFT'|'ACTIVE'|'CLOSED';plan:GoalStep[];review:string;revision:number}
export type GoalState={can_manage:boolean;actor_id:string;team:{id:string;name:string}[];goals:PerformanceGoal[]}
export function distributeGoal(target:number,period:string,people:string[],activity:string):GoalStep[]{
 if(!Number.isFinite(target)||target<=0||!/^\d{4}-\d{2}$/.test(period)||!people.length)return [];
 const unique=[...new Set(people)], units=Math.round(target*100),count=unique.length*4;
 if(units<count)return [];
 const lastDay=new Date(Number(period.slice(0,4)),Number(period.slice(5,7)),0).getDate();
 return unique.flatMap((profile_id,p)=>Array.from({length:4},(_,w)=>({id:crypto.randomUUID(),profile_id,team:'Équipe',week:w+1,due_on:`${period}-${String(w===3?lastDay:(w+1)*7).padStart(2,'0')}`,activity,target:(Math.floor(units/count)+(p*4+w<units%count?1:0))/100,actual:0,note:''})));
}
export function goalTotals(steps:GoalStep[]){return steps.reduce((r,s)=>({target:r.target+Number(s.target),actual:r.actual+Number(s.actual||0)}),{target:0,actual:0})}
