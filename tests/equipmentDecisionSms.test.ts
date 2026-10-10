import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest'
const mock=vi.hoisted(()=>({send:vi.fn(),serve:vi.fn()}));
vi.mock('../supabase/functions/_shared/http.ts',()=>({adminClient:vi.fn(),json:(_r:unknown,b:unknown,status=200)=>new Response(JSON.stringify(b),{status})}));
vi.mock('../supabase/functions/_shared/nimba.ts',()=>({sendNimbaSms:mock.send}));
let processDecisions:any;
beforeEach(async()=>{vi.resetModules();vi.clearAllMocks();vi.stubGlobal('Deno',{env:{get:vi.fn()},serve:mock.serve});processDecisions=(await import('../supabase/functions/equipment-decision-notify/index')).processEquipmentDecisions;mock.send.mockResolvedValue({uid:'provider-1'})});
afterEach(()=>vi.unstubAllGlobals());
function database(profile:any,rows:any[]=[{id:'sms',request_id:'request',profile_id:'u',tenant_owner_id:'tenant',body:'Décision'}]){
 const updates:any[]=[],insert=vi.fn().mockResolvedValue({});const db={rpc:vi.fn().mockResolvedValue({data:rows,error:null}),from:(table:string)=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:profile,error:null})})}),update:(values:any)=>({eq:async()=>{updates.push({table,...values});return {error:null}}}),insert})};return {db,updates,insert};
}
describe('SMS décisions matériel',()=>{
 it('envoie au demandeur de la bonne entreprise avec les clés de son espace',async()=>{const {db,updates}=database({active:true,phone:'+224600000000',tenant_owner_id:'tenant'});expect(await processDecisions(db,mock.send)).toEqual({processed:1,sent:1,failed:0,cancelled:0});expect(mock.send).toHaveBeenCalledWith(['+224600000000'],'Décision','tenant');expect(updates[0].status).toBe('SENT')});
 it('ne transmet aucun SMS à un autre espace',async()=>{const {db,updates}=database({active:true,phone:'+224600000000',tenant_owner_id:'other'});await processDecisions(db,mock.send);expect(mock.send).not.toHaveBeenCalled();expect(updates[0].status).toBe('CANCELLED')});
 it('trace l’absence de téléphone et avertit le propriétaire',async()=>{const {db,updates,insert}=database({active:true,phone:null,tenant_owner_id:'tenant'});await processDecisions(db,mock.send);expect(mock.send).not.toHaveBeenCalled();expect(updates[0].status).toBe('FAILED');expect(insert).toHaveBeenCalled()});
 it('ne prétend pas avoir envoyé quand Nimba refuse',async()=>{const {db,updates}=database({active:true,phone:'+224600000000',tenant_owner_id:'tenant'});mock.send.mockRejectedValue(new Error('Configuration SMS absente'));await processDecisions(db,mock.send);expect(updates[0]).toMatchObject({status:'FAILED',error:'Configuration SMS absente'})});
 it('ne traite rien quand la file est vide',async()=>{const {db}=database(null,[]);expect(await processDecisions(db,mock.send)).toEqual({processed:0,sent:0,failed:0,cancelled:0});expect(mock.send).not.toHaveBeenCalled()});
 it('refuse un appel sans le secret du planificateur',async()=>{const handler=mock.serve.mock.calls[0][0];const response=await handler(new Request('https://example.com'));expect(response.status).toBe(401)});
});
