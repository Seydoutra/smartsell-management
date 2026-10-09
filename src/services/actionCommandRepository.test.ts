import { beforeEach, describe, expect, it, vi } from 'vitest'
const api=vi.hoisted(()=>({getUser:vi.fn(),from:vi.fn(),select:vi.fn(),eq:vi.fn(),single:vi.fn()}))
vi.mock('./supabase',()=>({supabase:{auth:{getUser:api.getUser},from:api.from}}))
import { loadCommandReferences, verifyCommandSession } from './actionCommandRepository'
const profileId='11111111-1111-4111-8111-111111111111',tenant='22222222-2222-4222-8222-222222222222'
beforeEach(()=>{
  vi.resetAllMocks();api.getUser.mockResolvedValue({data:{user:{id:profileId}},error:null})
  const query={select:api.select,eq:api.eq,single:api.single,then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:[],error:null}).then(resolve)}
  api.from.mockReturnValue(query);api.select.mockReturnValue(query);api.eq.mockReturnValue(query)
  api.single.mockResolvedValue({data:{id:profileId,tenant_owner_id:tenant,active:true,role:'ADMIN'},error:null})
})
describe('isolation des références de commandes',()=>{
  it('ne lit rien si la session appartient à une autre personne',async()=>{
    api.getUser.mockResolvedValue({data:{user:{id:'other'}},error:null})
    await expect(verifyCommandSession(profileId,tenant)).rejects.toThrow('session a changé')
    expect(api.from).not.toHaveBeenCalled()
  })
  it('refuse un tenant incompatible et le portail client',async()=>{
    api.single.mockResolvedValue({data:{id:profileId,tenant_owner_id:'another',active:true,role:'ADMIN'},error:null})
    await expect(verifyCommandSession(profileId,tenant)).rejects.toThrow('non autorisée')
    api.single.mockResolvedValue({data:{id:profileId,tenant_owner_id:tenant,active:true,role:'CLIENT'},error:null})
    await expect(verifyCommandSession(profileId,tenant)).rejects.toThrow('non autorisée')
  })
  it('limite chaque lecture au tenant et n’ouvre pas de tables sans droit de lecture',async()=>{
    await loadCommandReferences(profileId,tenant,'FACTURE',key=>['clients.view','services.view'].includes(key))
    expect(api.from.mock.calls.map(call=>call[0])).toEqual(['profiles','clients','service_catalog'])
    expect(api.eq.mock.calls.filter(call=>call[0]==='tenant_owner_id')).toEqual([['tenant_owner_id',tenant],['tenant_owner_id',tenant]])
  })
  it('ne charge pas de roster pour une tâche sans droit d’attribution',async()=>{
    await loadCommandReferences(profileId,tenant,'TASK',key=>key==='projects.view')
    expect(api.from.mock.calls.map(call=>call[0])).toEqual(['profiles','projects'])
  })
})
