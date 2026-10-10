export const NETWORK_AVAILABLE='smartsell:network-available'
export const NETWORK_FAILURE='smartsell:network-failure'
export const CHECK_CONNECTION='smartsell:check-connection'

export function reportNetwork(available:boolean){
 if(typeof window!=='undefined')window.dispatchEvent(new Event(available?NETWORK_AVAILABLE:NETWORK_FAILURE))
}

/** Any HTTP response proves reachability, not authentication or database health. */
export async function checkServerReachability(
 url:string|undefined=import.meta.env.VITE_SUPABASE_URL,
 key:string|undefined=import.meta.env.VITE_SUPABASE_ANON_KEY
):Promise<boolean|null>{
 if(!url)return null
 const controller=new AbortController()
 const timeout=setTimeout(()=>controller.abort(),5000)
 try{
  await fetch(`${url.replace(/\/$/,'')}/auth/v1/health`,{
   method:'HEAD',cache:'no-store',credentials:'omit',signal:controller.signal,
   headers:key?{apikey:key}:undefined
  })
  return true
 }catch{return false}
 finally{clearTimeout(timeout)}
}
