// @vitest-environment jsdom
import {afterEach,describe,it,expect,vi} from 'vitest'
import {cleanup,fireEvent,render,screen} from '@testing-library/react'
import {GoalSimulator,GoalRadar} from './GoalCockpit'
import type {PerformanceGoal} from './lib/performanceGoals'
afterEach(cleanup)
const goal:PerformanceGoal={id:'g',title:'Revenu',metric:'GNF de chiffre d’affaires',target:100,period:'2026-10-01',status:'ACTIVE',plan:[],review:'',revision:1}
describe('cockpit des objectifs',()=>{
 it('ne montre aucun faux résultat sans hypothèses',()=>{render(<GoalSimulator data={{can_manage:true,generated_at:'',goals:{},sources:['MANUAL'],history:{average_invoice:null,won:null,lost:null}}}/>);expect(screen.queryByText('ventes nécessaires')).toBeNull();expect(screen.getByText(/Renseignez les quatre hypothèses/)).toBeTruthy()})
 it('masque les chiffres sans autorisation et ne présente pas zéro comme résultat',()=>{render(<GoalRadar goal={goal} evidence={{source:'COLLECTED',actual:null,frozen:false,accessible:false}} sources={['MANUAL']} busy={false} onSource={vi.fn()}/>);expect(screen.getByText('Chiffres masqués selon vos droits.')).toBeTruthy();expect(screen.queryByRole('progressbar')).toBeNull()})
 it('transmet le choix de source et fige le bilan clôturé',()=>{const fn=vi.fn();const {rerender}=render(<GoalRadar goal={goal} evidence={{source:'MANUAL',actual:5,frozen:false,accessible:true}} sources={['MANUAL','COLLECTED']} busy={false} onSource={fn}/>);fireEvent.change(screen.getByLabelText('Source de Revenu'),{target:{value:'COLLECTED'}});expect(fn).toHaveBeenCalledWith('COLLECTED');rerender(<GoalRadar goal={{...goal,status:'CLOSED'}} evidence={{source:'COLLECTED',actual:5,frozen:true,accessible:true}} sources={['MANUAL','COLLECTED']} busy={false} onSource={fn}/>);expect((screen.getByLabelText('Source de Revenu') as HTMLSelectElement).disabled).toBe(true)})
})
