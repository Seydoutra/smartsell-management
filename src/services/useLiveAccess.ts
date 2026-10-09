import {useEffect,useState} from 'react'
import type {AccessControl} from '../types/models'
import {getAccessControl} from './repository'

export function useLiveAccess(profileId:string){
 const [access,setAccess]=useState<AccessControl|null>(null),[loaded,setLoaded]=useState(false)
 const [loadedProfile,setLoadedProfile]=useState('')
 useEffect(()=>{
  let active=true,sequence=0
  setAccess(null);setLoaded(false)
  const refresh=async()=>{const version=++sequence;try{const value=await getAccessControl(profileId);if(active&&version===sequence){setAccess(value);setLoadedProfile(profileId);setLoaded(true)}}catch{if(active&&version===sequence){setAccess(null);setLoadedProfile(profileId);setLoaded(true)}}}
  const visible=()=>{if(document.visibilityState==='visible')void refresh()}
  void refresh();const timer=window.setInterval(()=>void refresh(),15000)
  window.addEventListener('focus',refresh);window.addEventListener('smartsell-access-updated',refresh);document.addEventListener('visibilitychange',visible)
  return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('smartsell-access-updated',refresh);document.removeEventListener('visibilitychange',visible)}
 },[profileId])
 return {access:loadedProfile===profileId?access:null,accessLoaded:loaded&&loadedProfile===profileId}
}
