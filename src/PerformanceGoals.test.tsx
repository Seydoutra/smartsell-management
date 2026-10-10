// @vitest-environment jsdom
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest'
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react'
const api=vi.hoisted(()=>({goals:vi.fn(),cockpit:vi.fn(),source:vi.fn()}))
vi.mock('./services/repository',()=>({performanceGoals:api.goals,askAiAssistant:vi.fn()}))
vi.mock('./services/goalCockpitRepository',()=>({loadGoalCockpit:api.cockpit,setGoalSource:api.source}))
import {PerformanceGoals} from './PerformanceGoals'
const g={id:'g',title:'Ventes',metric:'GNF',target:100,period:'2026-10-01',status:'ACTIVE',plan:[],review:'',revision:1}
const state={can_manage:true,actor_id:'u',team:[],goals:[g]}
beforeEach(()=>{vi.resetAllMocks();api.goals.mockResolvedValue(state);api.cockpit.mockResolvedValue({can_manage:true,generated_at:'',history:{average_invoice:null,won:null,lost:null},sources:['MANUAL','COLLECTED'],goals:{g:{source:'MANUAL',actual:0,accessible:true,frozen:false}}})})
afterEach(cleanup)
describe('objectifs et cockpit',()=>{
 it('affiche le simulateur et le radar pour le manager',async()=>{render(<PerformanceGoals/>);expect(await screen.findByText('Simuler une cible commerciale')).toBeTruthy();expect(screen.getByText('Radar de performance')).toBeTruthy()})
 it('garde le suivi manuel si le nouveau service échoue',async()=>{api.cockpit.mockRejectedValue(new Error('Migration absente'));render(<PerformanceGoals/>);expect(await screen.findByText(/Radar et simulation indisponibles/)).toBeTruthy();expect(screen.getByText('Ventes')).toBeTruthy()})
 it('ne montre pas le cockpit global aux collaborateurs',async()=>{api.goals.mockResolvedValue({...state,can_manage:false});api.cockpit.mockResolvedValue({can_manage:false,goals:{},history:{},sources:[]});render(<PerformanceGoals/>);await screen.findByText('Ventes');expect(screen.queryByText('Radar de performance')).toBeNull();expect(screen.queryByText('Simuler une cible commerciale')).toBeNull()})
 it('conserve la source précédente quand le serveur refuse',async()=>{api.source.mockRejectedValue(new Error('Droits financiers requis'));render(<PerformanceGoals/>);const select=await screen.findByLabelText('Source de Ventes');fireEvent.change(select,{target:{value:'COLLECTED'}});await waitFor(()=>expect(api.source).toHaveBeenCalledWith('g',1,'COLLECTED'));await screen.findByText('Droits financiers requis');expect((select as HTMLSelectElement).value).toBe('MANUAL')})
})
