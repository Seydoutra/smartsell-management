import { useEffect, useState } from 'react'
import {CHECK_CONNECTION,NETWORK_AVAILABLE,NETWORK_FAILURE,checkServerReachability} from './connectivity'

export function useOnlineStatus(probe:()=>Promise<boolean|null>=checkServerReachability){
  // Do not block working forms on an unreliable browser flag before verification.
  const [online,setOnline]=useState(true)
  useEffect(()=>{
    let live=true,checking=false,evidence=0
    const verify=async()=>{
      if(checking||document.visibilityState==='hidden')return
      checking=true;const started=evidence
      try{
        const reachable=await probe()
        if(live&&evidence===started)setOnline(reachable===null?navigator.onLine:reachable)
      }catch{if(live&&evidence===started)setOnline(false)}
      finally{checking=false}
    }
    const confirmed=()=>{evidence++;if(live)setOnline(true)}
    const visible=()=>{if(document.visibilityState==='visible')void verify()}
    const request=()=>{void verify()}
    for(const event of ['online','offline','focus',NETWORK_FAILURE,CHECK_CONNECTION])window.addEventListener(event,request)
    window.addEventListener(NETWORK_AVAILABLE,confirmed)
    document.addEventListener('visibilitychange',visible)
    void verify()
    const timer=window.setInterval(request,60000)
    return()=>{
      live=false;window.clearInterval(timer)
      for(const event of ['online','offline','focus',NETWORK_FAILURE,CHECK_CONNECTION])window.removeEventListener(event,request)
      window.removeEventListener(NETWORK_AVAILABLE,confirmed)
      document.removeEventListener('visibilitychange',visible)
    }
  },[probe])
  return online
}
