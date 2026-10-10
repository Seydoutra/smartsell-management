import {supabase} from './supabase'
import type {GoalCockpitState,GoalSource} from '../lib/goalCockpit'
export async function loadGoalCockpit():Promise<GoalCockpitState>{
 if(!supabase)throw new Error('Supabase non configuré')
 const {data,error}=await supabase.rpc('performance_goal_cockpit');if(error)throw new Error(error.message);return data as GoalCockpitState
}
export async function setGoalSource(id:string,revision:number,source:GoalSource){
 if(!supabase)throw new Error('Supabase non configuré')
 const {error}=await supabase.rpc('set_performance_goal_source',{p_id:id,p_revision:revision,p_source:source});if(error)throw new Error(error.message)
}
