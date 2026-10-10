import {useState} from 'react'
import {goalRisk,goalSources,simulateGoal,type GoalCockpitState,type GoalEvidence,type GoalSource} from './lib/goalCockpit'
import type {PerformanceGoal} from './lib/performanceGoals'
const number=(n:number)=>n.toLocaleString('fr-FR',{maximumFractionDigits:0})
export function GoalSimulator({data}:{data:GoalCockpitState}){
 const [target,setTarget]=useState(0),[basket,setBasket]=useState(data.history.average_invoice||0),[conversion,setConversion]=useState(0),[capacity,setCapacity]=useState(0)
 const result=simulateGoal(target,basket,conversion,capacity),closed=(data.history.won||0)+(data.history.lost||0)
 return <section className="panel goal-simulator"><span className="eyebrow">LABORATOIRE DE DÉCISION</span><h2>Simuler une cible commerciale</h2><p>Des hypothèses ajustables, aucune création ni attribution automatique.</p><div className="form-grid">
 <label>Cible de revenu GNF<input type="number" min="1" value={target||''} onChange={e=>setTarget(Number(e.target.value))}/></label>
 <label>Montant moyen par vente GNF<input type="number" min="1" value={basket||''} onChange={e=>setBasket(Number(e.target.value))}/></label>
 <label>Conversion estimée (%)<input type="number" min="0.01" max="100" step="0.01" value={conversion||''} onChange={e=>setConversion(Number(e.target.value))}/></label>
 <label>Prospects traités par jour (équipe)<input type="number" min="1" value={capacity||''} onChange={e=>setCapacity(Number(e.target.value))}/></label></div>
 <p className="goal-method">{data.history.average_invoice?`Repère : facture moyenne des trois derniers mois complets ${number(data.history.average_invoice)} GNF. Ce n’est pas un prix moyen de service.`:'Pas de moyenne de facturation accessible : renseignez votre hypothèse.'}</p>
 {closed>0&&<p>Repère CRM : {data.history.won} gagnés / {closed} prospects actuellement clôturés, soit {Math.round((data.history.won||0)/closed*100)} %. Ce stock historique n’est pas un taux de conversion mensuel.</p>}
 {result?<><div className="goal-kpis"><div><strong>{number(result.sales)}</strong> ventes nécessaires</div><div><strong>{number(result.prospects)}</strong> prospects estimés</div><div><strong>{number(result.days)}</strong> jours de capacité nécessaires</div></div><p>Répartition indicative : {number(result.weeklyProspects)} prospects par semaine sur quatre semaines. Si votre capacité dépasse les jours disponibles, ajustez la cible ou les moyens.</p></>:<p>Renseignez les quatre hypothèses pour obtenir votre simulation.</p>}
 </section>
}
export function GoalRadar({goal,evidence,sources,busy,onSource}:{goal:PerformanceGoal;evidence:GoalEvidence;sources:GoalSource[];busy:boolean;onSource:(source:GoalSource)=>void}){
 const r=evidence.actual===null?null:goalRisk(goal.target,evidence.actual,goal.period,goal.status)
 const labels:Record<string,string>={DRAFT:'À valider',DONE:'Cible atteinte',LATE:'Période terminée',UPCOMING:'À venir',EARLY:'Observation initiale',HIGH:'Risque élevé',WATCH:'À surveiller',ON_TRACK:'Sur la trajectoire'}
 return <section className={'goal-radar risk-'+(r?.risk||'HIDDEN')}><header><h3>Radar de performance</h3>{r&&<span className="goal-risk-label">{labels[r.risk]}</span>}</header>
 <label>Source de la progression globale<select aria-label={'Source de '+goal.title} disabled={busy||goal.status==='CLOSED'} value={evidence.source} onChange={e=>onSource(e.target.value as GoalSource)}>{[...new Set([...sources,evidence.source])].map(s=><option key={s} value={s} disabled={!sources.includes(s)}>{goalSources[s]}</option>)}</select></label>
 {!evidence.accessible?<p>Chiffres masqués selon vos droits.</p>:<><p><strong>{number(evidence.actual||0)} / {number(goal.target)}</strong> {goal.metric} {evidence.frozen?'· Bilan figé':'· Résultats au dernier chargement'}</p><progress max={goal.target} value={Math.min(goal.target,evidence.actual||0)} aria-label="Progression réelle globale"/>
 {r&&goal.status==='ACTIVE'&&<><p>Reste à réaliser : {number(r.remaining)} · {number(r.daysLeft)} jour(s) restant(s).</p>{r.risk==='HIGH'||r.risk==='WATCH'?<p>Le résultat est inférieur à la trajectoire linéaire. Priorité : examiner les étapes en retard et les blocages avec les responsables, puis valider un ajustement.</p>:<p>{r.risk==='DONE'?'Consolidez le résultat et préparez le bilan.':r.risk==='LATE'?'Préparez le bilan : la période prévue est terminée.':'Suivez les prochaines échéances avant de modifier la répartition.'}</p>}{r.forecast!==null&&r.risk!=='UPCOMING'&&r.risk!=='EARLY'&&<p className="goal-method">Projection linéaire indicative : {number(r.forecast)} en fin de mois. Effort moyen restant : {number(r.dailyNeeded)} par jour. Saisonnalité et activités futures non modélisées.</p>}</>}
 </>}
 {evidence.source!=='MANUAL'&&<p className="goal-method">Mesure de toute l’entreprise sur le mois choisi, non ventilée entre collaborateurs. Les étapes ci-dessous restent un suivi opérationnel déclaré, elles ne sont pas ajoutées au résultat automatique.</p>}
 </section>
}
