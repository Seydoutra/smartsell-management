export type ActivityEvent = { id:string; user:string; action:string; module:string; at:string; detail:string }
export type SessionSummary = { startedAt:string; lastSeenAt:string; activeSeconds:number; pages:number }
const EVENT_KEY='smartsell-demo-activity', SESSION_KEY='smartsell-demo-current-session'
import { isDemoMode, supabase } from './supabase'
const demoSeed: ActivityEvent[] = [
  {id:'ev1',user:'Mamadou Diallo',action:'Prospect modifié',module:'CRM',at:'2026-09-25T10:48:00Z',detail:'Atelier Horizon → Négociation'},
  {id:'ev2',user:'Fatou Sow',action:'Matériel sorti',module:'Matériel',at:'2026-09-25T10:22:00Z',detail:'Sony FX3 · Film institutionnel'},
  {id:'ev3',user:'Ibrahima Bah',action:'Tâche terminée',module:'Projets',at:'2026-09-25T09:56:00Z',detail:'Intégrer la page services'},
  {id:'ev4',user:'Mamadou Diallo',action:'Email envoyé',module:'Communication',at:'2026-09-25T09:34:00Z',detail:'Validation publication client'},
]
export function getDemoActivity():ActivityEvent[]{try{return JSON.parse(localStorage.getItem(EVENT_KEY)||'null')||demoSeed}catch{return demoSeed}}
export function trackActivity(action:string,module:string,detail=''){
  if(action!=='Session active'){const next=[{id:crypto.randomUUID(),user:'Traoré Seydou',action,module,detail,at:new Date().toISOString()},...getDemoActivity()].slice(0,100);localStorage.setItem(EVENT_KEY,JSON.stringify(next))}
  const raw=localStorage.getItem(SESSION_KEY)
  if(raw){const s=JSON.parse(raw) as SessionSummary;s.lastSeenAt=new Date().toISOString();if(action==='Page consultée')s.pages+=1;localStorage.setItem(SESSION_KEY,JSON.stringify(s))}
  if(!isDemoMode&&supabase){void supabase.auth.getSession().then(({data})=>{const token=data.session?.access_token;if(!token)return;const session=raw?JSON.parse(raw) as SessionSummary&{id?:string}:undefined;return fetch('/.netlify/functions/track-activity',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({action:action==='Connexion'?'LOGIN':action==='Déconnexion'?'LOGOUT':action==='Page consultée'?'PAGE_VIEW':action==='Session active'?'HEARTBEAT':action==='Export CSV'?'EXPORT':'CREATE',entityType:module,metadata:{detail},sessionId:session?.id})})})}
}
export function startSession(){const now=new Date().toISOString();if(!localStorage.getItem(SESSION_KEY))localStorage.setItem(SESSION_KEY,JSON.stringify({id:crypto.randomUUID(),startedAt:now,lastSeenAt:now,activeSeconds:0,pages:0}));trackActivity('Connexion','Sécurité','Session Super Admin ouverte')}
export function pulseSession(){const raw=localStorage.getItem(SESSION_KEY);if(!raw)return;const s=JSON.parse(raw) as SessionSummary;s.activeSeconds+=60;s.lastSeenAt=new Date().toISOString();localStorage.setItem(SESSION_KEY,JSON.stringify(s));trackActivity('Session active','Sécurité','Présence confirmée')}
export function endSession(){trackActivity('Déconnexion','Sécurité','Session fermée');localStorage.removeItem(SESSION_KEY)}
