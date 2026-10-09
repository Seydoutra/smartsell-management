// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
const api=vi.hoisted(()=>({load:vi.fn(),contract:vi.fn(),monthly:vi.fn(),measurement:vi.fn(),report:vi.fn()}))
vi.mock('./services/clientSocialReportingRepository',()=>({loadClientSocialReporting:api.load,saveClientServiceCommitment:api.contract,saveClientMonthlyCommitment:api.monthly,saveClientSocialMeasurement:api.measurement,generateClientMonthlyReport:api.report}))
vi.mock('./lib/invoicePdf',()=>({invoicePdfFile:vi.fn()}))
import ClientSocialDashboard from './ClientSocialDashboard'
const tenant='11111111-1111-4111-8111-111111111111',empty={measurements:[],commitments:[],contracts:[],reports:[],items:[]}
beforeEach(()=>{vi.resetAllMocks();api.load.mockResolvedValue(empty);api.contract.mockResolvedValue(undefined)})
afterEach(cleanup)
describe('tableau de bord contractuel du client',()=>{
  it('reste en lecture seule dans le portail, sans statistiques fictives',async()=>{
    render(<ClientSocialDashboard tenantOwnerId={tenant} clientId="client-a" clientName="Client QA"/>)
    await screen.findByText('Les engagements de ce mois n’ont pas encore été renseignés.')
    expect(api.load).toHaveBeenCalledWith(tenant,'client-a');expect(screen.queryByRole('button',{name:'Fixer les engagements récurrents'})).toBeNull()
    expect(screen.getByText(/Aucune situation de départ/)).toBeTruthy()
  })
  it('enregistre un contrat une fois, sans le transformer en objectif uniquement mensuel',async()=>{
    render(<ClientSocialDashboard tenantOwnerId={tenant} clientId="client-a" clientName="Client QA" canEdit/>)
    fireEvent.click(await screen.findByRole('button',{name:'Fixer les engagements récurrents'}))
    fireEvent.change(screen.getByLabelText('Publications promises'),{target:{value:'12'}})
    fireEvent.change(screen.getByLabelText('Vidéos promises'),{target:{value:'2'}})
    fireEvent.change(screen.getByLabelText('Reels promises'),{target:{value:'4'}})
    fireEvent.click(screen.getByRole('button',{name:'Enregistrer les engagements'}))
    await screen.findByText('Engagements contractuels récurrents enregistrés.')
    expect(api.contract).toHaveBeenCalledWith(tenant,'client-a',expect.objectContaining({publications:12,videos:2,reels:4}),undefined);expect(api.monthly).not.toHaveBeenCalled()
  })
  it('révise à partir du mois sélectionné sans écraser le contrat d’origine',async()=>{
    api.load.mockResolvedValue({...empty,contracts:[{id:'original',effective_month:'2026-01-01',publications:12,videos:2,reels:4}]})
    render(<ClientSocialDashboard tenantOwnerId={tenant} clientId="client-a" clientName="Client QA" canEdit/>)
    const button=await screen.findByRole('button',{name:'Réviser le contrat à partir de ce mois'})
    fireEvent.change(screen.getByLabelText('Mois du suivi client'),{target:{value:'2026-12'}});fireEvent.click(button)
    fireEvent.click(screen.getByRole('button',{name:'Enregistrer les engagements'}))
    await waitFor(()=>expect(api.contract).toHaveBeenCalledWith(tenant,'client-a',expect.objectContaining({month:'2026-12',publications:12}),undefined))
  })
  it('conserve les chiffres manquants comme non renseignés',async()=>{
    api.load.mockResolvedValue({...empty,measurements:[{id:'b',kind:'BASELINE',network:'FACEBOOK',account_key:'QA',measured_on:'2020-01-01',followers:100,likes:null,shares:null,reach:null,impressions:null,engagements:null}]})
    render(<ClientSocialDashboard tenantOwnerId={tenant} clientId="client-a" clientName="Client QA"/>)
    await screen.findByText('FACEBOOK · QA');expect(screen.getAllByText('Non renseigné').length).toBeGreaterThan(0)
    expect(screen.getByText(/évolution non évaluable/)).toBeTruthy()
  })
  it('affiche une erreur de migration sans charger une démonstration à sa place',async()=>{
    api.load.mockRejectedValue(new Error('Table absente'))
    render(<ClientSocialDashboard tenantOwnerId={tenant} clientId="client-a" clientName="Client QA" canEdit/>)
    await screen.findByRole('alert');expect(screen.queryByRole('button',{name:'Fixer les engagements récurrents'})).toBeNull()
  })
})
