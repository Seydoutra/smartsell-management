// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
const api=vi.hoisted(()=>({load:vi.fn(),verify:vi.fn(),client:vi.fn(),task:vi.fn(),project:vi.fn(),invoice:vi.fn(),quote:vi.fn(),track:vi.fn()}))
vi.mock('./services/actionCommandRepository',()=>({loadCommandReferences:api.load,verifyCommandSession:api.verify}))
vi.mock('./services/repository',()=>({createClient:api.client,createTask:api.task,createProject:api.project,createInvoice:api.invoice,createQuote:api.quote}))
vi.mock('./services/activityTracker',()=>({trackActivity:api.track}))
import ActionCommand, { type BrowserRecognition } from './ActionCommand'
import type { Profile } from './types/models'
const profile={id:'p',tenant_owner_id:'t',full_name:'QA',active:true,role:'ADMIN',must_change_password:false,department_id:null} as Profile
const refs={clients:[{id:'c',name:'Alpha'}],projects:[{id:'proj',name:'Campagne été',client_id:'c'}],profiles:[{id:'u',full_name:'Fatou'}],services:[]}
const onCreated=vi.fn(),onClose=vi.fn()
const props={profile,allowed:()=>true,blocked:false,onCreated,onClose}
const type=(text:string)=>{fireEvent.change(screen.getByLabelText('Votre instruction'),{target:{value:text}});fireEvent.click(screen.getByRole('button',{name:'Préparer l’action'}))}
beforeEach(()=>{vi.resetAllMocks();api.load.mockResolvedValue(refs);api.verify.mockResolvedValue(undefined);api.client.mockResolvedValue({id:'new',name:'Alpha'});api.task.mockResolvedValue({id:'task',title:'Visuels'});api.invoice.mockResolvedValue({id:'invoice',number:'FA-QA'});vi.stubGlobal('SpeechRecognition',undefined);vi.stubGlobal('webkitSpeechRecognition',undefined)})
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
describe('actions assistées sans clé IA',()=>{
  it('offre un repli clavier lorsque la dictée est indisponible, sans activation automatique',()=>{
    render(<ActionCommand {...props}/>);expect(api.load).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button',{name:'Activer le microphone'}))
    expect(screen.getByRole('alert').textContent).toContain('Saisissez votre instruction')
    expect(api.client).not.toHaveBeenCalled()
  })
  it('ne crée qu’après préparation ET confirmation et ne double pas sur un double clic',async()=>{
    render(<ActionCommand {...props}/>);type('Créer un client Alpha, email qa@example.com')
    await screen.findByRole('heading',{name:'Aperçu — Client'})
    const button=screen.getByRole('button',{name:'Confirmer et créer'}) as HTMLButtonElement
    expect(button.disabled).toBe(true);expect(api.client).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('checkbox',{name:/J’ai vérifié/}));fireEvent.click(button);fireEvent.click(button)
    await screen.findByText(/Client créé : Alpha/)
    expect(api.client).toHaveBeenCalledTimes(1);expect(api.client).toHaveBeenCalledWith({name:'Alpha',email:'qa@example.com',phone:null})
    expect(api.verify).toHaveBeenCalledWith('p','t');expect(onCreated).toHaveBeenCalledWith('CLIENT')
  })
  it('retire la confirmation si les champs sont modifiés',async()=>{
    render(<ActionCommand {...props}/>);type('Créer un client Alpha');await screen.findByRole('heading',{name:'Aperçu — Client'})
    fireEvent.click(screen.getByRole('checkbox',{name:/J’ai vérifié/}));fireEvent.change(screen.getByLabelText('Nom'),{target:{value:'Beta'}})
    expect((screen.getByRole('button',{name:'Confirmer et créer'}) as HTMLButtonElement).disabled).toBe(true)
  })
  it('refuse une commande hors droits avant toute lecture',async()=>{
    render(<ActionCommand {...props} allowed={key=>key==='tasks.create'}/>);type('Créer un client Alpha')
    await screen.findByRole('alert');expect(api.load).not.toHaveBeenCalled();expect(api.client).not.toHaveBeenCalled()
  })
  it('un essai expiré / hors réseau ne permet ni préparation ni création',()=>{
    render(<ActionCommand {...props} blocked/>);fireEvent.change(screen.getByLabelText('Votre instruction'),{target:{value:'Créer un client Alpha'}})
    expect((screen.getByRole('button',{name:'Préparer l’action'}) as HTMLButtonElement).disabled).toBe(true)
    expect(api.client).not.toHaveBeenCalled();expect(api.load).not.toHaveBeenCalled()
  })
  it('une session qui change avant confirmation bloque l’écriture',async()=>{
    api.verify.mockRejectedValue(new Error('La session a changé.'))
    render(<ActionCommand {...props}/>);type('Créer un client Alpha');await screen.findByRole('heading',{name:'Aperçu — Client'})
    fireEvent.click(screen.getByRole('checkbox',{name:/J’ai vérifié/}));fireEvent.click(screen.getByRole('button',{name:'Confirmer et créer'}))
    await screen.findByRole('alert');expect(api.client).not.toHaveBeenCalled();expect(onCreated).not.toHaveBeenCalled()
  })
  it('la dictée transcrit sans exécuter ; fermeture arrête le microphone et ignore les résultats tardifs',()=>{
    const start=vi.fn(),abort=vi.fn();let current:BrowserRecognition
    class Recognition {lang='';continuous=false;interimResults=false;onresult=null;onerror=null;onend=null;start=start;stop=vi.fn();abort=abort;constructor(){current=this}}
    vi.stubGlobal('SpeechRecognition',Recognition)
    const view=render(<ActionCommand {...props}/>)
    expect(start).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Activer le microphone'}));expect(start).toHaveBeenCalledTimes(1)
    act(()=>current!.onresult?.({results:[[{transcript:'Créer un client Alpha'}]]}))
    expect((screen.getByLabelText('Votre instruction') as HTMLTextAreaElement).value).toBe('Créer un client Alpha')
    expect(api.client).not.toHaveBeenCalled();view.unmount();expect(abort).toHaveBeenCalledTimes(1);expect(current!.onresult).toBeNull()
  })
  it('préremplit la facture et exige une confirmation avant la création réelle',async()=>{
    render(<ActionCommand {...props}/>);type('Créer une facture, client Alpha, service Community management, montant 700000 GNF, échéance 2026-12-10, sans TVA')
    await screen.findByRole('heading',{name:'Aperçu — Facture'})
    expect((screen.getByLabelText('Client') as HTMLSelectElement).value).toBe('c')
    expect((screen.getByLabelText('Prestation') as HTMLInputElement).value).toBe('Community management')
    expect((screen.getByLabelText('Prix unitaire') as HTMLInputElement).value).toBe('700000')
    expect(api.invoice).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('checkbox',{name:/J’ai vérifié le client/}));fireEvent.click(screen.getByRole('button',{name:'Confirmer et générer'}))
    await waitFor(()=>expect(api.invoice).toHaveBeenCalledWith(expect.objectContaining({client_id:'c',due_date:'2026-12-10',currency:'GNF',items:[{description:'Community management',quantity:1,unit_price:700000,tax_rate:0}]})))
    await screen.findByText(/Facture créée : FA-QA/);expect(onCreated).toHaveBeenCalledWith('FACTURE')
  })
  it('attribue une tâche au responsable exact après validation',async()=>{
    render(<ActionCommand {...props}/>);type('Créer une tâche Visuels, projet Campagne été, attribuer à Fatou, échéance 2026-12-10')
    await screen.findByRole('heading',{name:'Aperçu — Tâche'})
    fireEvent.click(screen.getByRole('checkbox',{name:/J’ai vérifié/}));fireEvent.click(screen.getByRole('button',{name:'Confirmer et créer'}))
    await waitFor(()=>expect(api.task).toHaveBeenCalledWith(expect.objectContaining({project_id:'proj',assignee_id:'u',due_at:'2026-12-10T17:00:00.000Z'}),['u']))
  })
})
