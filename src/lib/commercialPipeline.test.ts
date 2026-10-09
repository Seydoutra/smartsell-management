import { describe, expect, it } from 'vitest'
import { commercialStages, moduleNavigationHash, offerFocus, prospectPriority, rankedProspects, readModuleIntent } from './commercialPipeline'
import type { Prospect, Service } from '../types/models'
const now=Date.parse('2026-10-09T12:00:00Z')
const lead=(input:Partial<Prospect>={})=>({id:'p',company:'Prospect',stage:'NOUVEAU',phone:'+224620000000',last_contact_at:null,next_follow_up_at:null,...input}) as Prospect
const service=(input:Partial<Service>={})=>({id:'s',name:'Site web',active:true,...input}) as Service
describe('pilotage commercial sans données inventées',()=>{
  it('inclut les sept étapes, y compris les pertes',()=>expect(commercialStages.map(([stage])=>stage)).toContain('PERDU'))
  it('place une négociation à relancer avant un nouveau contact',()=>{
    const rows=rankedProspects([lead({id:'new'}),lead({id:'due',stage:'NEGOCIATION',next_follow_up_at:'2026-10-08T12:00:00Z'})],now)
    expect(rows[0].prospect.id).toBe('due');expect(rows[0].reason).toMatch(/échéance/)
  })
  it('exclut les opportunités clôturées des priorités et des offres',()=>{
    const rows=[lead({stage:'GAGNE',need:'Site web'}),lead({stage:'PERDU',need:'Site web'})]
    expect(rankedProspects(rows,now)).toEqual([]);expect(offerFocus(rows,[service()],now)).toEqual([])
  })
  it('ne traite pas une date invalide ou future comme une relance échue',()=>{
    expect(prospectPriority(lead({next_follow_up_at:'incorrect'}),now).score).toBe(15)
    expect(prospectPriority(lead({next_follow_up_at:'2026-12-01T12:00:00Z'}),now).reason).not.toMatch(/échéance/)
  })
  it('propose de compléter les coordonnées plutôt que de prétendre appeler',()=>expect(prospectPriority(lead({phone:null,email:null}),now).action).toMatch(/coordonnées/))
  it('rapproche uniquement les besoins exprimés des services actifs',()=>{
    const rows=offerFocus([lead({need:'Création de site WEB'}),lead({id:'other',need:'Photographie'}),lead({id:'empty',need:null})],[service(),service({id:'inactive',active:false})],now)
    expect(rows).toHaveLength(1);expect(rows[0].prospects.map(p=>p.id)).toEqual(['p']);expect(rows[0]).not.toHaveProperty('revenue')
  })
  it('laisse un espace neuf entièrement vide',()=>{expect(rankedProspects([],now)).toEqual([]);expect(offerFocus([],[service()],now)).toEqual([])})
  it('conserve les filtres clients et les actions dans les liens de navigation',()=>{
    const hash=moduleNavigationHash('Facturation','client-é',{view:'DEVIS',action:'new-document',request:'2'})
    const query=hash.split('?')[1];expect(new URLSearchParams(query).get('client')).toBe('client-é')
    expect(readModuleIntent(query)).toEqual({view:'DEVIS',action:'new-document',request:'2'})
    expect(moduleNavigationHash('Clients')).toBe('#/Clients')
  })
})
