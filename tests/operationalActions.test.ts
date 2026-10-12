import {describe,it,expect} from 'vitest';
import {operationalActions} from '../supabase/functions/_shared/operational-actions';
const now=new Date('2026-10-12T12:00:00Z');
const project={id:'p',name:'Site web',client_id:'c',status:'EN_COURS',progress:20,ends_on:null,manager_id:'m'};
const task={id:'t',title:'Maquette',project_id:'p',status:'EN_COURS',priority:'NORMALE',due_at:null,assignee_id:'m'};
describe('operational recommendations',()=>{
 it('keeps empty workspace empty',()=>expect(operationalActions('owner',[],[],now)).toEqual([]));
 it('spots project without tasks',()=>expect(operationalActions('owner',[project],[],now)[0].reason).toContain('Aucune tâche'));
 it('spots upcoming task and project deadlines',()=>{const rows=operationalActions('owner',[{...project,ends_on:'2026-10-15'}],[{...task,due_at:'2026-10-14T12:00:00Z'}],now);expect(rows).toHaveLength(2);expect(rows.every(r=>String(r.reason).includes('7 prochains jours'))).toBe(true)});
 it('honors multiple assignees and project members',()=>expect(operationalActions('owner',[{...project,manager_id:null,project_members:[{profile_id:'m'}]}],[{...task,assignee_id:null,task_assignees:[{profile_id:'m'}]}],now)).toEqual([]));
 it('combines reasons without duplicates and does not mark tasks completed',()=>{const rows=operationalActions('owner',[],[{...task,assignee_id:null,due_at:'2026-10-10T12:00:00Z'}],now);expect(rows).toHaveLength(1);expect(rows[0].reason).toContain('Aucun responsable');expect(rows[0].action_type).toBe('NAVIGATE');expect(rows[0].owner_id).toBe('owner')});
 it('ignores closed tasks and projects',()=>expect(operationalActions('owner',[{...project,status:'TERMINE'}],[{...task,status:'ANNULE',assignee_id:null}],now)).toEqual([]));
});
