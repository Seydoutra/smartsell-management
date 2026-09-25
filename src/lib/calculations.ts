export type InvoiceLine = { quantity: number; unitPrice: number; taxRate?: number }
export const invoiceSubtotal = (lines: InvoiceLine[]) => lines.reduce((sum,l)=>sum+l.quantity*l.unitPrice,0)
export const invoiceTotal = (lines: InvoiceLine[], discount=0) => lines.reduce((sum,l)=>sum+l.quantity*l.unitPrice*(1+(l.taxRate??0)/100),0)-discount
export const invoiceBalance = (total:number, payments:number[]) => Math.max(0,total-payments.reduce((a,b)=>a+b,0))
export const hasBookingConflict = (startA:string,endA:string,startB:string,endB:string) => new Date(startA)<new Date(endB)&&new Date(startB)<new Date(endA)
