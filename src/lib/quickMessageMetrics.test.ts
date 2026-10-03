import { describe, expect, it } from 'vitest'
import { quickMessageMetrics } from './quickMessageMetrics'
import type { QuickMessageLog } from '../services/repository'

const row=(id:number,channel:'SMS'|'EMAIL',status:string,sent_at:string,cost:number|null=null):QuickMessageLog=>({id,channel,recipient:'test@example.com',status,sms_cost:cost,sms_currency:cost==null?null:'GNF',sent_at,metadata:null})

describe('quickMessageMetrics',()=>{
  const now=new Date('2026-10-03T12:00:00')
  const logs=[row(1,'SMS','SENT','2026-10-03T10:00:00',12),row(2,'SMS','QUEUED','2026-10-02T10:00:00'),row(3,'EMAIL','FAILED','2026-10-01T10:00:00'),row(4,'EMAIL','DELIVERED','2026-10-03T09:00:00')]
  it('sépare les statuts fournisseur sans confondre une attente avec une livraison',()=>{
    const result=quickMessageMetrics(logs,'ALL',now)
    expect([result.accepted,result.pending,result.failed,result.costs]).toEqual([2,1,1,12])
    expect(result.days.reduce((sum,day)=>sum+day.count,0)).toBe(4)
  })
  it('filtre les envois directs par canal',()=>{
    const sms=quickMessageMetrics(logs,'SMS',now)
    expect([sms.selected.length,sms.accepted,sms.pending,sms.failed]).toEqual([2,1,1,0])
    expect(quickMessageMetrics(logs,'EMAIL',now).costs).toBe(0)
  })
})
