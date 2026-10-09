import { describe, expect, it } from 'vitest'
import { allowedSocialViews, metricValue, publishedLinks, validateEditorialTransition, validateTenantId, type SocialRights } from './smartSocial'
import type { CreativeApproval, EditorialItem, SocialIntegration } from '../types/models'
const read:SocialRights={view:true,create:false,update:false,delete:false}
const denied:SocialRights={view:false,create:false,update:false,delete:false}
const item={id:'post',client_id:'client',title:'Test',caption:'Texte',platform:'Instagram',platforms:['Instagram'],status:'EN_CREATION',created_at:'2026-10-08'} as EditorialItem
const approval=(version:number,status:string)=>({id:String(version),editorial_item_id:'post',client_id:'client',version,status,created_at:`2026-10-0${version}`} as CreativeApproval)
describe('Smart Social dans Smart Management',()=>{
  it('ne confond pas les droits éditoriaux et les connexions',()=>{
    expect(allowedSocialViews(read,denied)).toEqual(['CALENDAR','TABLE','BOARD','REPORT'])
    expect(allowedSocialViews(denied,read)).toEqual(['CONNECTIONS'])
    expect(allowedSocialViews(denied,denied)).toEqual([])
  })
  it('refuse un espace absent ou invalide',()=>{
    expect(()=>validateTenantId('')).toThrow()
    expect(()=>validateTenantId('first-workspace')).toThrow()
  })
  it('ne simule pas de métriques à partir d’une URL de page',()=>{
    const row={id:'test',client_id:null,provider:'INSTAGRAM',account_name:'Test',account_url:'https://example.test',created_at:'2026-10-08',status:'NON_CONFIGURE',metrics:{followers:100},last_synced_at:'2026-10-08'} as SocialIntegration
    expect(metricValue(row,'followers')).toBeNull()
    expect(metricValue({...row,status:'CONNECTE',last_synced_at:null},'followers')).toBeNull()
    expect(metricValue({...row,status:'CONNECTE',metrics:{followers:0}},'followers')).toBe(0)
    expect(metricValue({...row,status:'CONNECTE',metrics:{followers:NaN}},'followers')).toBeNull()
  })
  it('exige l’approbation de la dernière version et du bon client',()=>{
    const next={...item,status:'PLANIFIE'}
    expect(validateEditorialTransition(item,next,[approval(1,'APPROUVE')])).toBeNull()
    expect(validateEditorialTransition(item,next,[approval(1,'APPROUVE'),approval(2,'MODIFICATIONS_DEMANDEES')])).toMatch(/dernière version/)
    expect(validateEditorialTransition(item,next,[{...approval(1,'APPROUVE'),client_id:'other'}])).toMatch(/dernière version/)
  })
  it('redemande une validation après modification du texte, visuel ou réseau',()=>{
    for(const change of [{caption:'Nouveau texte'},{asset_urls:['https://example.test/visual.png']},{platforms:['Facebook']},{client_id:'other'}]){
      expect(validateEditorialTransition(item,{...item,...change,status:'PUBLIE'},[approval(1,'APPROUVE')])).toMatch(/nouvelle validation/)
    }
  })
  it('contrôle la version exacte mémorisée par la base, pas seulement un ancien statut approuvé',()=>{
    const next={...item,status:'PLANIFIE'}
    expect(validateEditorialTransition(item,next,[{...approval(1,'APPROUVE'),editorial_snapshot:item} as CreativeApproval])).toBeNull()
    expect(validateEditorialTransition(item,next,[{...approval(1,'APPROUVE'),editorial_snapshot:{...item,caption:'Ancienne légende'}} as CreativeApproval])).toMatch(/version exacte/)
    expect(validateEditorialTransition(item,next,[{...approval(1,'APPROUVE'),editorial_snapshot:null} as CreativeApproval])).toMatch(/version exacte/)
  })
  it('autorise les brouillons et les publications internes sans validation client',()=>{
    expect(validateEditorialTransition(undefined,{...item,status:'EN_CREATION'},[])).toBeNull()
    expect(validateEditorialTransition(undefined,{...item,client_id:null,status:'PLANIFIE'},[])).toBeNull()
  })
  it('affiche tous les liens publiés et rejette les liens exécutables',()=>{
    expect(publishedLinks({...item,platform_links:{Facebook:'https://facebook.com/post',Instagram:'https://instagram.com/post',Bad:'javascript:alert(1)'},published_url:'https://instagram.com/post'})).toHaveLength(2)
  })
})
