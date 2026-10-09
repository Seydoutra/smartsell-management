// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
const api=vi.hoisted(()=>({load:vi.fn(),save:vi.fn(),action:vi.fn(),remove:vi.fn()}))
vi.mock('./services/companyPurchases',()=>({loadCompanyCosts:api.load,saveCompanyExpense:api.save,companyPurchaseAction:api.action,deleteCompanyExpense:api.remove}))
import CompanyCosts from './CompanyCosts'
const all={view:true,create:true,update:true,delete:true};
const data={expenses:[{id:'e',description:'Loyer',kind:'DEPENSE',amount:100,currency:'GNF',status:'APPROUVE',spent_on:'2026-10-09'},{id:'f',description:'Charge refusée',kind:'DEPENSE',amount:900,currency:'GNF',status:'REFUSE',spent_on:'2026-10-09'},{id:'g',description:'Logiciel',kind:'ACHAT',amount:200,currency:'EUR',status:'BROUILLON',spent_on:'2026-10-09'}],purchases:[{id:'p',title:'Disque',justification:'Sauvegardes',estimated_cost:100,currency:'GNF',status:'APPROUVE'}],projects:[],suppliers:[]};
beforeEach(()=>{vi.resetAllMocks();api.load.mockResolvedValue(data);api.action.mockResolvedValue('expense')});afterEach(cleanup);
describe('registre achats et dépenses',()=>{
 it('ne charge aucune donnée sans droit comptable',()=>{render(<CompanyCosts tenantOwnerId="tenant" rights={{...all,view:false}}/>);expect(api.load).not.toHaveBeenCalled()});
 it('sépare les devises et exclut les refus et les budgets des charges approuvées',async()=>{
  render(<CompanyCosts tenantOwnerId="tenant" rights={all}/>);await screen.findByText('Loyer');expect(screen.queryByText('Logiciel')).toBeNull();expect(screen.queryByText(/900.*GNF/)).not.toBeNull(); // visible in the register, not approved metrics
  const kpis=document.querySelector('.cost-kpis')!;expect(kpis.textContent).toContain('100');expect(kpis.textContent).not.toContain('900');expect(kpis.textContent).not.toContain('200');
  fireEvent.change(screen.getByLabelText('Devise des indicateurs'),{target:{value:'EUR'}});fireEvent.click(screen.getByRole('button',{name:'Achats fournisseurs'}));expect(screen.getByText('Logiciel')).toBeTruthy();expect(screen.queryByText('Loyer')).toBeNull();
 });
 it('montre les fiches en lecture seule sans création ni approbation',async()=>{
  render(<CompanyCosts tenantOwnerId="tenant" rights={{view:true,create:false,update:false,delete:false}}/>);await screen.findByText('Loyer');expect(screen.queryByRole('button',{name:'Nouvelle dépense'})).toBeNull();fireEvent.click(screen.getAllByRole('button',{name:'Voir la fiche'})[0]);expect(screen.getByLabelText('Objet / description').matches(':disabled')).toBe(true);expect(screen.queryByRole('button',{name:'Enregistrer'})).toBeNull();
 });
 it('convertit un achat approuvé avec son montant réel sans créer une seconde charge côté interface',async()=>{
  render(<CompanyCosts tenantOwnerId="tenant" rights={all}/>);await screen.findByText('Loyer');fireEvent.click(screen.getByRole('button',{name:'Demandes d’achat'}));fireEvent.click(screen.getByRole('button',{name:'Enregistrer la charge réelle'}));fireEvent.change(screen.getByLabelText('Montant réel'),{target:{value:'110'}});fireEvent.click(screen.getByRole('button',{name:'Enregistrer'}));await waitFor(()=>expect(api.action).toHaveBeenCalledWith('CONVERT',expect.objectContaining({id:'p',amount:110})));expect(api.save).not.toHaveBeenCalled();
 });
})
