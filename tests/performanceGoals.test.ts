import {describe,it,expect} from 'vitest'
import {distributeGoal,goalTotals} from '../src/lib/performanceGoals'
import {isSingleSms} from '../supabase/functions/_shared/trialSms'
describe('Répartition des objectifs',()=>{
 it('répartit exactement la cible sans dépassement par arrondi',()=>{const p=distributeGoal(100,'2026-02',['a','b','c'],'Prospection');expect(p).toHaveLength(12);expect(goalTotals(p).target).toBeCloseTo(100,2);expect(p.filter(s=>s.week===4).every(s=>s.due_on==='2026-02-28')).toBe(true)})
 it('refuse une cible invalide ou aucun responsable',()=>{expect(distributeGoal(0,'2026-02',['a'],'x')).toEqual([]);expect(distributeGoal(50,'2026-02',[],'x')).toEqual([])})
 it('compte les SMS GSM, étendus et Unicode',()=>{expect(isSingleSms('A'.repeat(160))).toBe(true);expect(isSingleSms('A'.repeat(161))).toBe(false);expect(isSingleSms('€'.repeat(81))).toBe(false);expect(isSingleSms('’'.repeat(71))).toBe(false);expect(isSingleSms('Bonjour !')).toBe(true)})
})
