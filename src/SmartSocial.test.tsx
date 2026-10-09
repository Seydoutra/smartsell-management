// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
const api=vi.hoisted(()=>({load:vi.fn(),connections:vi.fn(),save:vi.fn(),remove:vi.fn(),requestApproval:vi.fn()}))
vi.mock('./services/smartSocialRepository',()=>({loadSocialEditorial:api.load,loadSocialConnections:api.connections,saveSocialEditorial:api.save,deleteSocialEditorial:api.remove,saveSocialReference:vi.fn(),deleteSocialReference:vi.fn(),importSocialEditorial:vi.fn()}))
vi.mock('./services/repository',()=>({createCreativeApproval:api.requestApproval,uploadEditorialAsset:vi.fn(),createEditorialItemsBatch:vi.fn()}))
vi.mock('./CanvaIntegrationPanel',()=>({default:()=> <p>Connecteur Canva existant</p>}))
vi.mock('./EditorialCanvaField',()=>({default:()=>null}))
import SmartSocial from './SmartSocial'
import type { EditorialItem } from './types/models'
const tenant='11111111-1111-4111-8111-111111111111'
const read={view:true,create:false,update:false,delete:false}
const all={view:true,create:true,update:true,delete:true}
const item={id:'p',client_id:null,project_id:null,title:'Publication test isolée',caption:'Texte prévu',platform:'Instagram',platforms:['Instagram'],status:'EN_CREATION',created_at:'2026-10-08',publish_at:null} as EditorialItem
beforeEach(()=>{
  vi.resetAllMocks()
  api.load.mockResolvedValue({items:[item],approvals:[],clients:[],projects:[]})
  api.connections.mockResolvedValue({connections:[],clients:[]})
  api.save.mockResolvedValue({...item,title:'Créée'})
})
afterEach(cleanup)
describe('parcours Smart Social',()=>{
  it('masque les connexions et les actions de mutation pour un lecteur éditorial',async()=>{
    render(<SmartSocial tenantOwnerId={tenant} editorialRights={read} initialView="TABLE"/>)
    await screen.findByText('Publication test isolée')
    expect(screen.queryByRole('button',{name:'Connexions'})).toBeNull()
    expect(screen.queryByRole('button',{name:'Nouvelle publication'})).toBeNull()
    expect(screen.queryByRole('button',{name:'Importer un calendrier'})).toBeNull()
    fireEvent.click(screen.getByText('Publication test isolée'))
    expect(screen.getByText(/Lecture seule/)).toBeTruthy()
    expect(screen.queryByRole('button',{name:'Enregistrer la publication'})).toBeNull()
    expect(screen.queryByRole('button',{name:'Supprimer'})).toBeNull()
  })
  it('charge uniquement les connexions quand aucun droit éditorial n’est accordé',async()=>{
    render(<SmartSocial tenantOwnerId={tenant} connectionRights={read}/>)
    await screen.findByText('Connecteur Canva existant')
    expect(api.load).not.toHaveBeenCalled()
    expect(screen.queryByRole('button',{name:'Calendrier'})).toBeNull()
    expect(screen.queryByRole('button',{name:'Ajouter une page'})).toBeNull()
  })
  it('ne charge rien sans droits',()=>{
    render(<SmartSocial tenantOwnerId={tenant}/>)
    expect(api.load).not.toHaveBeenCalled();expect(api.connections).not.toHaveBeenCalled()
  })
  it('enregistre une nouvelle publication puis recharge le calendrier',async()=>{
    render(<SmartSocial tenantOwnerId={tenant} editorialRights={all}/>)
    await waitFor(()=>expect((screen.getByRole('button',{name:'Nouvelle publication'}) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button',{name:'Nouvelle publication'}))
    fireEvent.change(screen.getByLabelText('Titre de la publication'),{target:{value:'Créée'}})
    fireEvent.click(screen.getByRole('button',{name:'Enregistrer la publication'}))
    await screen.findByText('Publication enregistrée.')
    expect(api.save).toHaveBeenCalledWith(tenant,expect.objectContaining({title:'Créée',status:'A_REDIGER',client_id:null}),undefined)
    expect(api.load).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('laisse le formulaire ouvert si le serveur refuse l’enregistrement',async()=>{
    api.save.mockRejectedValue(new Error('Erreur contrôlée'))
    render(<SmartSocial tenantOwnerId={tenant} editorialRights={all}/>)
    await waitFor(()=>expect((screen.getByRole('button',{name:'Nouvelle publication'}) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button',{name:'Nouvelle publication'}))
    fireEvent.change(screen.getByLabelText('Titre de la publication'),{target:{value:'Créée'}})
    fireEvent.click(screen.getByRole('button',{name:'Enregistrer la publication'}))
    await screen.findAllByText('Erreur contrôlée')
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.queryByText('Publication enregistrée.')).toBeNull()
  })
  it('annonce une panne sans afficher de données fictives ou actions de création',async()=>{
    api.load.mockRejectedValue(new Error('Connexion indisponible'))
    render(<SmartSocial tenantOwnerId={tenant} editorialRights={all}/>)
    await screen.findByRole('alert')
    expect(screen.queryByText('Publication test isolée')).toBeNull()
    expect((screen.getByRole('button',{name:'Nouvelle publication'}) as HTMLButtonElement).disabled).toBe(true)
  })
})
