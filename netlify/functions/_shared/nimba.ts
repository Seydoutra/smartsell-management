export type NimbaMessage = { uid?:string; id?:string; status?:string; message_cost?:number; currency?:string }

const normalizePhone=(value:string)=>{
  const digits=value.replace(/\D/g,'')
  if(digits.startsWith('224')) return digits
  if(digits.length===9) return `224${digits}`
  return digits
}

export async function sendNimbaSms(recipients:string[],message:string){
  const serviceId=process.env.NIMBA_SERVICE_ID||process.env.SMS_API_KEY
  const secretToken=process.env.NIMBA_SECRET_TOKEN||process.env.SMS_API_SECRET
  const senderName=process.env.NIMBA_SENDER_NAME||process.env.SMS_SENDER_ID||'SMARTSELL'
  if(!serviceId||!secretToken) throw new Error('Identifiants Nimba SMS manquants')
  const response=await fetch('https://api.nimbasms.com/v1/messages',{
    method:'POST',
    headers:{'content-type':'application/json',authorization:`Basic ${Buffer.from(`${serviceId}:${secretToken}`).toString('base64')}`},
    body:JSON.stringify({to:recipients.map(normalizePhone),message,sender_name:senderName}),
  })
  const data=await response.json().catch(()=>({})) as NimbaMessage&{detail?:string;message?:string}
  if(!response.ok) throw new Error(data.detail||data.message||`Nimba SMS a répondu ${response.status}`)
  return data
}
