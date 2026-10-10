import type {AccessControl, Profile} from './types/models'
import {isActionAllowed} from './lib/access'
import type {Role} from './lib/permissions'
import './effective-access.css'

type Group={readonly module:string;readonly actions:readonly (readonly [string,string])[]}
export default function EffectiveAccessSummary({profile,access,groups,dirty}:{profile:Profile;access:AccessControl;groups:readonly Group[];dirty:boolean}){
  const owner=profile.is_platform_owner===true||profile.tenant_owner_id===profile.id
  const client=(profile.roles?.length?profile.roles:[profile.role]).includes('CLIENT')
  const active=profile.active&&!client
  const expired=Boolean(profile.access_expires_at&&new Date(profile.access_expires_at).getTime()<=Date.now())
  const reason=(module:string,key:string)=>!active?'Compte inactif ou profil client':owner?'Propriétaire : accès non restreint':!access.allowed_modules.includes(module)?'Module masqué':access.denied_permissions.includes(key.split('.')[0]+'.view')?'Consultation interdite':access.denied_permissions.includes(key)?'Action interdite':'Autorisé dans cet espace'
  const allowed=(key:string)=>active&&isActionAllowed((profile.roles||[profile.role]) as Role[],access,true,key,owner)
  return <section className="effective-access" aria-label="Résumé des droits effectifs">
    <h3>Qui peut voir et faire quoi ?</h3>
    <p role="status">{dirty?'Modifications non enregistrées : cette simulation n’est pas encore appliquée au compte.':'Configuration chargée. Les changements doivent être enregistrés pour être appliqués.'}</p>
    <p>Les rôles ne donnent pas de passe-droit. Seul le propriétaire de l’espace conserve un accès non restreint. Aucun accès aux données des autres entreprises n’est accordé ici.</p>
    {owner&&<p>Ce compte est propriétaire : retirer une case ne limite pas ses droits.</p>}
    {expired&&<p>Accès d’essai expiré : les opérations payantes restent bloquées indépendamment de ces autorisations.</p>}
    <details><summary>Consulter le détail des autorisations effectives</summary>
      {groups.map(group=><div key={group.module} className="effective-access-group"><h4>{group.module}</h4>{group.actions.map(([key,label])=><div key={key}><span>{label}</span><strong className={allowed(key)?'granted':'refused'}>{allowed(key)?'Autorisé':'Bloqué'}</strong><small>{reason(group.module,key)}</small></div>)}</div>)}
    </details>
    <p>Ce résumé décrit les autorisations de module et d’action, pas un accès « uniquement ses dossiers ». Le périmètre précis des données doit également être vérifié côté serveur.</p>
  </section>
}
