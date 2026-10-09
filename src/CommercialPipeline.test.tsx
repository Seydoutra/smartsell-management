// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
const api=vi.hoisted(()=>({load:vi.fn(),offers:vi.fn(),save:vi.fn(),move:vi.fn()}))
vi.mock('./services/commercialPipelineRepository',()=>({loadCommercialProspects:api.load,loadCommercialOffers:api.offers,saveCommercialProspect:api.save,moveCommercialProspect:api.move}))
import CommercialPipeline from './CommercialPipeline'
import type { Prospect } from './types/models'
const tenant='11111111-1111-4111-8111-111111111111'
const read={view:true,create:false,update:false,delete:false},all={view:true,create:true,update:true,delete:true}
const lead={id:'p',company:'Prospect QA',stage:'NOUVEAU',need:'Site web',phone:'620000000',created_at:'2026-10-09',next_follow_up_at:null} as Prospect
beforeEach(()=>{vi.resetAllMocks();api.load.mockResolvedValue([lead]);api.offers.mockResolvedValue([{id:'s',name:'Site web',active:true}]);api.save.mockResolvedValue({...lead,company:'Créé'});api.move.mockResolvedValue({...lead,stage:'PERDU'})})
afterEach(cleanup)
describe('parcours commercial et droits',()=>{
  it('ne charge rien sans droits et ne charge pas le catalogue sans autorisation',async()=>{
    const view=render(<CommercialPipeline tenantOwnerId={tenant} rights={{...read,view:false}}/>)
    expect(api.load).not.toHaveBeenCalled();expect(api.offers).not.toHaveBeenCalled()
    view.rerender(<CommercialPipeline tenantOwnerId={tenant} rights={read}/>)
    await screen.findByLabelText('Rechercher un prospect')
    expect(api.load).toHaveBeenCalledWith(tenant);expect(api.offers).not.toHaveBeenCalled()
    expect(screen.queryByText('Quelles offres travailler ?')).toBeNull()
  })
  it('permet de consulter la fiche sans boutons de modification pour un lecteur',async()=>{
    render(<CommercialPipeline tenantOwnerId={tenant} rights={read}/>)
    await screen.findByLabelText('Rechercher un prospect')
    expect(screen.queryByText('Nouveau prospect')).toBeNull()
    expect(screen.queryByLabelText('Étape de Prospect QA')).toBeNull()
    fireEvent.click(screen.getAllByText('Prospect QA')[0])
    expect(screen.getByRole('dialog')).toBeTruthy();expect(screen.queryByRole('button',{name:'Enregistrer le prospect'})).toBeNull()
    expect(screen.getByLabelText('Entreprise / prospect').matches(':disabled')).toBe(true)
  })
  it('crée un prospect avec une relance et sans consentement inventé',async()=>{
    render(<CommercialPipeline tenantOwnerId={tenant} rights={all}/>)
    await waitFor(()=>expect((screen.getByRole('button',{name:'Nouveau prospect'}) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button',{name:'Nouveau prospect'}))
    fireEvent.change(screen.getByLabelText('Entreprise / prospect'),{target:{value:'Créé'}})
    fireEvent.change(screen.getByLabelText('Prochaine relance'),{target:{value:'2026-10-15T10:30'}})
    fireEvent.click(screen.getByRole('button',{name:'Enregistrer le prospect'}))
    await screen.findByText('Prospect et suivi commercial enregistrés.')
    expect(api.save).toHaveBeenCalledWith(tenant,expect.objectContaining({company:'Créé',stage:'NOUVEAU',next_follow_up_at:expect.any(String),sms_opt_in:false,email_opt_in:false}),undefined)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('enregistre le déplacement puis conserve une opportunité perdue dans son tableau',async()=>{
    render(<CommercialPipeline tenantOwnerId={tenant} rights={all}/>)
    const select=await screen.findByLabelText('Étape de Prospect QA')
    fireEvent.change(select,{target:{value:'PERDU'}})
    await screen.findByText('Étape commerciale enregistrée.')
    expect(api.move).toHaveBeenCalledWith(tenant,'p','PERDU')
    expect((screen.getByLabelText('Étape de Prospect QA') as HTMLSelectElement).value).toBe('PERDU')
    expect(screen.getByText(/Aucune opportunité ouverte/)).toBeTruthy()
  })
  it('ne déplace pas visuellement une carte si le serveur refuse',async()=>{
    api.move.mockRejectedValue(new Error('Connexion indisponible'))
    render(<CommercialPipeline tenantOwnerId={tenant} rights={all}/>)
    fireEvent.change(await screen.findByLabelText('Étape de Prospect QA'),{target:{value:'PERDU'}})
    await screen.findByRole('alert');expect((screen.getByLabelText('Étape de Prospect QA') as HTMLSelectElement).value).toBe('NOUVEAU')
  })
  it('annonce une panne sans afficher de fausses données et bloque la création',async()=>{
    api.load.mockRejectedValue(new Error('Lecture refusée'))
    render(<CommercialPipeline tenantOwnerId={tenant} rights={all}/>)
    await screen.findByRole('alert');expect(screen.queryByText('Opportunités ouvertes')).toBeNull()
    expect((screen.getByRole('button',{name:'Nouveau prospect'}) as HTMLButtonElement).disabled).toBe(true)
  })
  it('affiche les offres autorisées et rouvre la création depuis le sous-menu',async()=>{
    const view=render(<CommercialPipeline tenantOwnerId={tenant} rights={all} canViewOffers intent={{action:'new-prospect',request:'1'}}/>)
    await screen.findByRole('dialog');expect(api.offers).toHaveBeenCalledWith(tenant)
    fireEvent.click(screen.getByRole('button',{name:'Fermer la fiche prospect'}))
    view.rerender(<CommercialPipeline tenantOwnerId={tenant} rights={all} canViewOffers intent={{action:'new-prospect',request:'2'}}/>)
    await screen.findByRole('dialog')
  })
})
