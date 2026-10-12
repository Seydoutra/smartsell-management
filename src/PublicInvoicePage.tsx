import {useEffect,useState} from 'react';
export default function PublicInvoicePage(){
 const [html,setHtml]=useState(''),[error,setError]=useState('');
 useEffect(()=>{const token=new URLSearchParams(location.hash.split('?')[1]||'').get('token');if(!token||!/^[0-9a-f]{48}$/.test(token)){setError('Facture indisponible');return;}
 const abort=new AbortController();void fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invoice-reminders?format=json&token=${token}`,{signal:abort.signal,cache:'no-store',headers:{apikey:import.meta.env.VITE_SUPABASE_ANON_KEY}}).then(async r=>{if(!r.ok)throw new Error('Facture indisponible ou lien désactivé');const body=await r.json();setHtml(body.html);}).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>abort.abort();},[]);
 return error?<main role="alert" style={{padding:30}}>{error}</main>:html?<iframe title="Consultation publique de la facture" sandbox="" srcDoc={html} style={{width:'100%',height:'100dvh',border:0,background:'#fff'}}/>:<main role="status" style={{padding:30}}>Chargement de la facture…</main>;
}
