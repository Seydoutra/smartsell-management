import { describe, expect, it } from 'vitest'
import { portalCalendarEvents } from '../ClientPortalExperience'
import type { EditorialItem, Project } from '../types/models'

describe('calendrier du portail client',()=>{
  it('réunit les publications et les jalons des projets dans l’ordre chronologique',()=>{
    const projects=[{id:'p1',name:'Site web',starts_on:'2026-10-08',ends_on:'2026-10-24',status:'EN_COURS'}] as Project[]
    const editorial=[{id:'e1',title:'Annonce',publish_at:'2026-10-12T10:00:00Z',platforms:['Instagram'],platform:'Instagram'}] as EditorialItem[]
    expect(portalCalendarEvents(projects,editorial).map(item=>[item.kind,item.title])).toEqual([
      ['Début de projet','Site web'],['Publication','Annonce'],['Échéance de projet','Site web'],
    ])
  })
  it('n’ajoute aucun événement sans date',()=>{
    expect(portalCalendarEvents([{id:'p1',starts_on:null,ends_on:null} as Project],[{id:'e1',publish_at:null} as EditorialItem])).toEqual([])
  })
})
