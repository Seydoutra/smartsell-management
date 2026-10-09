import { beforeEach, describe, expect, it, vi } from 'vitest'
const api=vi.hoisted(()=>({from:vi.fn()}))
vi.mock('./supabase',()=>({supabase:{from:api.from}}))
import { deleteSocialEditorial, deleteSocialReference, importSocialEditorial, loadSocialConnections, loadSocialEditorial, saveSocialReference } from './smartSocialRepository'
const tenant='11111111-1111-4111-8111-111111111111'
function response(data:unknown=[],error:unknown=null) {
  const result={data,error}
  const query:any={then:(resolve:any,reject:any)=>Promise.resolve(result).then(resolve,reject)}
  for(const method of ['select','eq','order','insert','update','delete'])query[method]=vi.fn(()=>query)
  query.single=vi.fn(()=>Promise.resolve(result))
  return query
}
beforeEach(()=>vi.resetAllMocks())
describe('requêtes Smart Social scindées par tenant',()=>{
  it('refuse tout accès sans identifiant explicite',async()=>{
    await expect(loadSocialEditorial('')).rejects.toThrow(/Espace/)
    await expect(loadSocialConnections('invalid')).rejects.toThrow(/Espace/)
    expect(api.from).not.toHaveBeenCalled()
  })
  it('filtre chaque lecture éditoriale sur le tenant actif',async()=>{
    const queries=Array.from({length:4},()=>response())
    queries.forEach(q=>api.from.mockReturnValueOnce(q))
    expect(await loadSocialEditorial(tenant)).toEqual({items:[],approvals:[],clients:[],projects:[]})
    queries.forEach(q=>expect(q.eq).toHaveBeenCalledWith('tenant_owner_id',tenant))
  })
  it('ne remplace pas une panne serveur par des données de démonstration',async()=>{
    api.from.mockReturnValue(response([], {message:'RLS refusée'}))
    await expect(loadSocialConnections(tenant)).rejects.toThrow('RLS refusée')
  })
  it('crée uniquement une référence sans jeton, statut connecté ni métriques inventées',async()=>{
    const query=response({id:'ref'})
    api.from.mockReturnValue(query)
    await saveSocialReference(tenant,{provider:'FACEBOOK',client_id:null,account_name:' Page ',account_url:'https://facebook.com/test'})
    expect(query.insert).toHaveBeenCalledWith({provider:'FACEBOOK',client_id:null,account_name:'Page',account_url:'https://facebook.com/test',tenant_owner_id:tenant,status:'NON_CONFIGURE'})
  })
  it('borne les modifications à une référence non connectée du tenant',async()=>{
    const query=response({id:'ref'});api.from.mockReturnValue(query)
    await saveSocialReference(tenant,{id:'ref',provider:'FACEBOOK',client_id:null,account_name:'Page',account_url:null})
    expect(query.eq).toHaveBeenCalledWith('tenant_owner_id',tenant)
    expect(query.eq).toHaveBeenCalledWith('id','ref')
    expect(query.eq).toHaveBeenCalledWith('status','NON_CONFIGURE')
    expect(query.update.mock.calls[0][0]).not.toHaveProperty('status')
  })
  it('ne supprime jamais une fiche d’un autre espace ou une connexion OAuth',async()=>{
    const query=response({id:'ref'});api.from.mockReturnValue(query)
    await deleteSocialReference(tenant,'ref');await deleteSocialEditorial(tenant,'post')
    expect(query.eq).toHaveBeenCalledWith('tenant_owner_id',tenant)
    expect(query.eq).toHaveBeenCalledWith('status','NON_CONFIGURE')
    expect(query.eq).toHaveBeenCalledWith('id','post')
  })
  it('refuse un client étranger avant d’enregistrer une référence',async()=>{
    const query=response(null,{message:'Client invisible'});api.from.mockReturnValue(query)
    await expect(saveSocialReference(tenant,{provider:'FACEBOOK',client_id:'other-client',account_name:'Page',account_url:null})).rejects.toThrow('Client invisible')
    expect(query.insert).not.toHaveBeenCalled()
  })
  it('n’importe pas de contenus directement publiés sans validation',async()=>{
    await expect(importSocialEditorial(tenant,[{title:'Test',status:'PUBLIE'}])).rejects.toThrow(/préparation/)
    expect(api.from).not.toHaveBeenCalled()
  })
})
