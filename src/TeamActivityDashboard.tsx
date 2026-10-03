import { useEffect, useMemo, useState } from 'react'
import { Activity, Clock3, RefreshCw, Users } from 'lucide-react'
import { listTeamActivity } from './services/repository'
import type { ActivityLog, Profile, UserSession } from './types/models'
import './team-activity.css'

type Data = {profiles:Profile[];sessions:UserSession[];logs:ActivityLog[]}
const initial:Data={profiles:[],sessions:[],logs:[]}
const since=()=>Date.now()-7*24*60*60*1000

export default function TeamActivityDashboard({tenantOwnerId}:{tenantOwnerId:string}){
  const [data,setData]=useState<Data>(initial)
  const [busy,setBusy]=useState(true)
  const [error,setError]=useState('')
  const load=()=>{setBusy(true);setError('');void listTeamActivity(tenantOwnerId).then(setData).catch(cause=>setError(cause instanceof Error?cause.message:'Activité indisponible')).finally(()=>setBusy(false))}
  useEffect(()=>{load()},[tenantOwnerId])
  const rows=useMemo(()=>data.profiles.map(profile=>{
    const sessions=data.sessions.filter(row=>row.profile_id===profile.id)
    const logs=data.logs.filter(row=>row.actor_id===profile.id)
    const recentSessions=sessions.filter(row=>new Date(row.last_seen_at).getTime()>=since())
    const recentLogs=logs.filter(row=>new Date(row.created_at).getTime()>=since())
    const minutes=Math.round(recentSessions.reduce((sum,row)=>sum+Number(row.active_seconds||0),0)/60)
    const pages=recentSessions.reduce((sum,row)=>sum+Number(row.pages_viewed||0),0)
    const last=sessions[0]?.last_seen_at||null
    const score=Math.min(100,Math.round((recentSessions.length?20:0)+Math.min(30,minutes/12)+Math.min(30,recentLogs.length*3)+Math.min(20,pages*2)))
    return {profile,minutes,pages,actions:recentLogs.length,sessions:recentSessions.length,last,score}
  }),[data])
  const connected=rows.filter(row=>row.sessions>0).length
  const minutes=rows.reduce((sum,row)=>sum+row.minutes,0)
  const actions=rows.reduce((sum,row)=>sum+row.actions,0)
  return <section className="team-activity-dashboard" aria-label="Tableau de bord des collaborateurs">
    <div className="team-activity-head"><div><span className="eyebrow"><i/> COLLABORATEURS UNIQUEMENT</span><h2>Connexion & participation</h2><p>Activité des sept derniers jours dans votre équipe. Les inscrits SaaS d’autres entreprises ne sont pas inclus.</p></div><button type="button" onClick={load} disabled={busy}><RefreshCw/>{busy?'Chargement…':'Actualiser'}</button></div>
    {error&&<p role="alert" className="error-banner">{error}</p>}
    <div className="team-activity-kpis"><article><Users/><strong>{data.profiles.length}</strong><span>Collaborateurs</span></article><article><Activity/><strong>{connected}</strong><span>Connectés cette semaine</span></article><article><Clock3/><strong>{minutes} min</strong><span>Temps actif</span></article><article><Activity/><strong>{actions}</strong><span>Actions enregistrées</span></article></div>
    <div className="team-activity-list">{rows.map(({profile,minutes,pages,actions,sessions,last,score})=><article key={profile.id}><div className="team-activity-person"><span>{profile.avatar_url?<img src={profile.avatar_url} alt=""/>:profile.full_name.slice(0,2).toUpperCase()}</span><div><strong>{profile.full_name}</strong><small>{last?`Dernière connexion : ${new Date(last).toLocaleString('fr-FR')}`:'Aucune connexion enregistrée'}</small></div></div><div className="team-activity-stats"><span><b>{sessions}</b> session(s)</span><span><b>{minutes}</b> min</span><span><b>{pages}</b> pages</span><span><b>{actions}</b> actions</span></div><div className="team-activity-score"><span>Participation <b>{score}/100</b></span><i><b style={{width:`${score}%`}}/></i></div></article>)}</div>
    {!busy&&!rows.length&&<p className="team-activity-empty">Aucun collaborateur dans cet espace.</p>}
    <small className="team-activity-note">La participation est un indicateur d’activité sur l’application, pas une évaluation automatique de la qualité du travail. Données limitées aux 1 000 dernières sessions et actions de l’équipe.</small>
  </section>
}
