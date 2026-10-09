import { beforeEach, describe, expect, it, vi } from 'vitest'
const api=vi.hoisted(()=>({from:vi.fn()}))
vi.mock('./supabase',()=>({supabase:{from:api.from}}))
import { loadCommercialOffers, loadCommercialProspects, moveCommercialProspect, saveCommercialProspect } from './commercialPipelineRepository'
const tenant='11111111-1111-4111-8111-111111111111'
function response(data:unknown=[],error:unknown=null){const result={data,error};const query:any={then:(resolve:any,reject:any)=>Promise.resolve(result).then(resolve,reject)};for(const method of ['select','eq','order','insert','update'])query[method]=vi.fn(()=>query);query.single=vi.fn(()=>Promise.resolve(result));return query}
beforeEach(()=>vi.resetAllMocks())
describe('pipeline isolé par entreprise',()=>{
  it('filtre toutes les lectures sur le tenant et utilise le catalogue existant',async()=>{
    const query=response();api.from.mockReturnValue(query);await loadCommercialProspects(tenant);await loadCommercialOffers(tenant)
    expect(query.eq).toHaveBeenCalledWith('tenant_owner_id',tenant);expect(api.from).toHaveBeenCalledWith('service_catalog');expect(query.select).not.toHaveBeenCalledWith(expect.stringMatching(/unit_price/))
  })
  it('refuse une lecture sans espace et une étape invalide avant toute requête',async()=>{
    await expect(loadCommercialProspects('')).rejects.toThrow();await expect(moveCommercialProspect(tenant,'p','INCONNU')).rejects.toThrow();expect(api.from).not.toHaveBeenCalled()
  })
  it('borne les mutations et refuse de réassigner le tenant par le payload',async()=>{
    const query=response({id:'p'});api.from.mockReturnValue(query)
    await saveCommercialProspect(tenant,{company:' QA ',stage:'NOUVEAU',tenant_owner_id:'other'} as any,'p')
    expect(query.eq).toHaveBeenCalledWith('tenant_owner_id',tenant);expect(query.eq).toHaveBeenCalledWith('id','p');expect(query.update.mock.calls[0][0]).not.toHaveProperty('tenant_owner_id')
    expect(query.update.mock.calls[0][0].company).toBe('QA')
  })
  it('annonce le refus serveur sans confirmation fictive',async()=>{api.from.mockReturnValue(response(null,{message:'Refus RLS'}));await expect(moveCommercialProspect(tenant,'p','PERDU')).rejects.toThrow('Refus RLS')})
})
