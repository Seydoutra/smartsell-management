import {describe,it,expect} from 'vitest'
import {goalRisk,simulateGoal} from '../src/lib/goalCockpit'
describe('simulation et radar',()=>{
 it('calcule les ventes, prospects et capacité sans taux inventé',()=>{expect(simulateGoal(50000000,1000000,20,10)).toEqual({sales:50,prospects:250,days:25,weeklyProspects:63})})
 it('refuse les hypothèses absentes, infinies ou impossibles',()=>{expect(simulateGoal(1,0,20,1)).toBeNull();expect(simulateGoal(1,1,101,1)).toBeNull();expect(simulateGoal(Infinity,1,20,1)).toBeNull()})
 it('ne prédit rien avant le mois et observe les premiers jours',()=>{expect(goalRisk(100,0,'2026-10-01','ACTIVE','2026-09-20').risk).toBe('UPCOMING');expect(goalRisk(100,0,'2026-10-01','ACTIVE','2026-10-02').risk).toBe('EARLY')})
 it('différencie danger, surveillance, trajectoire et réussite',()=>{expect(goalRisk(100,10,'2026-10-01','ACTIVE','2026-10-16').risk).toBe('HIGH');expect(goalRisk(100,40,'2026-10-01','ACTIVE','2026-10-16').risk).toBe('WATCH');expect(goalRisk(100,55,'2026-10-01','ACTIVE','2026-10-16').risk).toBe('ON_TRACK');expect(goalRisk(100,120,'2026-10-01','ACTIVE','2026-10-16').risk).toBe('DONE')})
 it('traite février et un mois terminé sans division par zéro',()=>{const r=goalRisk(100,50,'2026-02-01','ACTIVE','2026-03-01');expect(r.risk).toBe('LATE');expect(r.daysLeft).toBe(0);expect(Number.isFinite(r.dailyNeeded)).toBe(true)})
})
