import { useEffect, useState } from 'react'
import { canvaAction, listTeamProfiles } from './services/repository'
import type { Profile } from './types/models'
import './canva-access-manager.css'

type Grant={profileId:string;enabled:boolean;editorialAccess:boolean}

export default function CanvaAccessManager({currentProfileId}:{currentProfileId:string}){
  const [profiles,setProfiles]=useState<Profile[]>([])
  const [owner,setOwner]=useState(false),[grants,setGrants]=useState<Record<string,Grant>>({}),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('')
  useEffect(()=>{let alive=true;void canvaAction<{canManage:boolean}>('status').then(async status=>{
    if(!alive||!status.canManage)return
    setOwner(true)
    const [result,members]=await Promise.all([canvaAction<{items:Grant[]}>('permissions'),listTeamProfiles()])
    if(alive){setGrants(Object.fromEntries(result.items.map(item=>[item.profileId,item])));setProfiles(members)}
  }).catch(cause=>{if(alive)setError(cause instanceof Error?cause.message:'Droits Canva indisponibles')});return()=>{alive=false}},[])
  if(!owner)return null
  const members=profiles.filter(profile=>profile.id!==currentProfileId&&profile.role!=='CLIENT'&&!(profile.roles||[]).includes('CLIENT'))
  const change=async(profile:Profile,enabled:boolean)=>{
    setBusy(profile.id);setError('');setNotice('')
    try{
      await canvaAction('set-access',undefined,{target_profile_id:profile.id,enabled})
      setGrants(current=>({...current,[profile.id]:{profileId:profile.id,enabled,editorialAccess:enabled||Boolean(current[profile.id]?.editorialAccess)}}))
      setNotice(`${profile.full_name} : accès Canva ${enabled?'activé':'retiré'}.`)
    }catch(cause){setError(cause instanceof Error?cause.message:'Modification impossible')}
    finally{setBusy('')}
  }
  return <section className="panel canva-access-manager" aria-label="Autorisations Canva des collaborateurs"><div className="canva-access-manager-head"><span className="canva-mark">C</span><div><h2>Accès Canva des collaborateurs</h2><p>Choisissez qui peut consulter et ouvrir les créations du compte Canva connecté à cet espace.</p></div></div><p className="canva-access-explanation">Activer Canva donne aussi le droit de voir le calendrier éditorial. Retirer Canva ne retire pas les autres droits éditoriaux. Cela ne ferme pas une session déjà ouverte directement sur canva.com.</p>{error&&<p className="error-banner" role="alert">{error}</p>}{notice&&<p className="success-banner" role="status">{notice}</p>}<div className="canva-access-rows">{members.map(profile=><label key={profile.id} className="canva-access-row"><span><strong>{profile.full_name}</strong><small>{profile.email||'Sans e-mail'} · {grants[profile.id]?.enabled?'Autorisé':'Sans accès Canva'}</small></span><input type="checkbox" aria-label={`Autoriser Canva pour ${profile.full_name}`} checked={Boolean(grants[profile.id]?.enabled)} disabled={Boolean(busy)||!profile.active} onChange={event=>void change(profile,event.target.checked)}/></label>)}{!members.length&&<p>Aucun collaborateur à autoriser pour le moment.</p>}</div></section>
}
