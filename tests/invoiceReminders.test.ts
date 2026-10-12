import {describe,it,expect} from 'vitest';
import {invoiceReminderMessage,publicInvoiceHtml} from '../supabase/functions/_shared/invoice-reminders';
describe('Invoice reminder content',()=>{
 it('includes invoice, due date, remaining balance and public link',()=>{const m=invoiceReminderMessage({step:1,number:'FAC-42',due_date:'2026-10-30',remaining:500,currency:'GNF'},'https://example.com/#invoice?token=secret');expect(m).toContain('FAC-42');expect(m).toContain('30/10/2026');expect(m).toContain('500 GNF');expect(m).toContain('#invoice?token=');});
 it('distinguishes three messages',()=>{const base={number:'FAC-42',due_date:'2026-10-30',remaining:500,currency:'GNF'};expect(new Set([1,2,3].map(step=>invoiceReminderMessage({...base,step},'url'))).size).toBe(3);});
 it('escapes user content and reflects partial payment',()=>{const html=publicInvoiceHtml({number:'FAC',issue_date:'2026-10-12',due_date:'2026-10-30',total:1000,currency:'GNF',clients:{name:'<script>alert(1)</script>'},invoice_items:[{description:'<img src=x>',quantity:1,unit_price:1000}]},400);expect(html).not.toContain('<script>');expect(html).not.toContain('<img src=x>');expect(html).toContain('Partiellement payée');expect(html).toContain('600 GNF');});
});
