export type GoalSource='MANUAL'|'BILLED'|'COLLECTED'|'TASKS'
export const goalSources:Record<GoalSource,string>={MANUAL:'Saisie des étapes',BILLED:'Facturation GNF',COLLECTED:'Encaissements GNF',TASKS:'Tâches terminées'}
export type GoalEvidence={source:GoalSource;actual:number|null;frozen:boolean;accessible:boolean}
export type GoalCockpitState={can_manage:boolean;generated_at:string;goals:Record<string,GoalEvidence>;history:{average_invoice:number|null;won:number|null;lost:number|null};sources:GoalSource[]}
export function simulateGoal(target:number,basket:number,conversion:number,contactsPerDay:number){
 if(![target,basket,conversion,contactsPerDay].every(Number.isFinite)||target<=0||basket<=0||conversion<=0||conversion>100||contactsPerDay<=0)return null
 const sales=Math.ceil(target/basket),prospects=Math.ceil(sales/(conversion/100)),days=Math.ceil(prospects/contactsPerDay)
 return {sales,prospects,days,weeklyProspects:Math.ceil(prospects/4)}
}
export function goalRisk(target:number,actual:number,period:string,status:string,today=new Date().toISOString().slice(0,10)){
 const start=Date.parse(period.slice(0,7)+'-01T00:00:00Z'),now=Date.parse(today+'T00:00:00Z');const d=new Date(start);const end=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1),days=(end-start)/86400000
 const elapsed=Math.max(0,Math.min(days,(now-start)/86400000+1)),pace=elapsed/days,ratio=target>0?actual/target:0
 const forecast=elapsed>0?actual/elapsed*days:null
 const risk=status==='DRAFT'?'DRAFT':ratio>=1?'DONE':now>=end?'LATE':now<start?'UPCOMING':elapsed<4?'EARLY':ratio<pace*.65?'HIGH':ratio<pace*.9?'WATCH':'ON_TRACK'
 return {risk,forecast,expected:target*pace,remaining:Math.max(0,target-actual),dailyNeeded:Math.max(0,target-actual)/Math.max(1,days-elapsed),daysLeft:Math.max(0,days-elapsed)}
}
