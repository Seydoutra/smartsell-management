import {beforeEach,describe,expect,it,vi} from 'vitest'
const api=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn(),select:vi.fn(),eq:vi.fn(),single:vi.fn()}))
vi.mock('./supabase',()=>({supabase:{rpc:api.rpc,from:api.from}}))
import {recordPayment,convertQuoteToInvoice} from './repository'
beforeEach(()=>{vi.clearAllMocks();api.from.mockReturnValue(api);api.select.mockReturnValue(api);api.eq.mockReturnValue(api);api.single.mockResolvedValue({data:{id:'invoice'},error:null})})
describe('billing retry boundaries',()=>{
 it('preserves the payment attempt identity and traceability on a retry',async()=>{api.rpc.mockResolvedValue({data:'payment',error:null});const input={operation_id:'fixed-operation',invoice_id:'invoice',amount:200,method:'Espèces',paid_at:'2026-10-10T05:00:00Z',reference:'REF',cashbox:'Caisse'};await recordPayment(input);await recordPayment(input);expect(api.rpc.mock.calls[0]).toEqual(api.rpc.mock.calls[1]);expect(api.rpc).toHaveBeenCalledWith('record_invoice_payment_once',{p_operation_id:'fixed-operation',p_invoice_id:'invoice',p_amount:200,p_method:'Espèces',p_paid_at:'2026-10-10T05:00:00.000Z',p_reference:'REF',p_cashbox:'Caisse'})})
 it('does not silently retry or announce an uncertain payment as successful',async()=>{api.rpc.mockResolvedValue({data:null,error:{message:'Failed to fetch'}});await expect(recordPayment({operation_id:'fixed',invoice_id:'invoice',amount:200,method:'Espèces'})).rejects.toThrow('Failed to fetch');expect(api.rpc).toHaveBeenCalledTimes(1)})
 it('retrieves the invoice returned by a conversion instead of creating another one',async()=>{api.rpc.mockResolvedValue({data:'invoice',error:null});expect(await convertQuoteToInvoice('quote','2026-10-31')).toEqual({id:'invoice'});expect(api.rpc).toHaveBeenCalledWith('create_invoice_from_quote',{p_quote_id:'quote',p_due_date:'2026-10-31'});expect(api.eq).toHaveBeenCalledWith('id','invoice')})
})
