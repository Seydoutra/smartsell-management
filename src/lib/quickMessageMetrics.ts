import type { QuickMessageLog } from '../services/repository'

export function quickMessageMetrics(logs:QuickMessageLog[],channel:'ALL'|'SMS'|'EMAIL',now=new Date()){
  const selected=logs.filter(log=>channel==='ALL'||log.channel===channel)
  const accepted=selected.filter(log=>log.status==='SENT'||log.status==='DELIVERED').length
  const pending=selected.filter(log=>log.status==='QUEUED').length
  const failed=selected.filter(log=>log.status==='FAILED').length
  const costs=selected.filter(log=>log.channel==='SMS'&&log.sms_cost!=null).reduce((sum,log)=>sum+Number(log.sms_cost),0)
  const days=Array.from({length:7},(_,index)=>{
    const date=new Date(now.getFullYear(),now.getMonth(),now.getDate()-(6-index))
    const next=new Date(date);next.setDate(date.getDate()+1)
    return {date:date.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'}),count:selected.filter(log=>{const sent=new Date(log.sent_at);return sent>=date&&sent<next}).length}
  })
  return {selected,accepted,pending,failed,costs,days}
}
