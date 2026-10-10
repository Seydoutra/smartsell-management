import { createClient } from '@supabase/supabase-js'
import {reportNetwork} from '../lib/connectivity'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const isDemoMode = import.meta.env.VITE_DEMO_MODE !== 'false' || !url || !anonKey
export const supabase = !isDemoMode ? createClient(url, anonKey, {
 auth:{persistSession:true,autoRefreshToken:true},
 global:{fetch:async(input,init)=>{
  try{const response=await fetch(input,init);reportNetwork(true);return response}
  catch(error){if(!(error&&typeof error==='object'&&'name' in error&&error.name==='AbortError'))reportNetwork(false);throw error}
 }}
}) : null
