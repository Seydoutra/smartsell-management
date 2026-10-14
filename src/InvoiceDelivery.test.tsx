// @vitest-environment jsdom
import {beforeEach,describe,expect,it,vi} from 'vitest'
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react'
import InvoiceDelivery from './InvoiceDelivery'
import type {Invoice} from './types/models'
const api=vi.hoisted(()=>({invoiceDeliveryBalance:vi.fn(),listCommercialDocuments:vi.fn(),createDeliveryFromInvoice:vi.fn()}));
vi.mock('./services/repository',()=>api);
vi.mock('./lib/commercialPdf',()=>({commercialPdfFile:vi.fn()}));
const invoice={id:'invoice',number:'FAC-1'} as Invoice;
beforeEach(()=>{cleanup();vi.clearAllMocks();api.listCommercialDocuments.mockResolvedValue([]);api.invoiceDeliveryBalance.mockResolvedValue([{id:'line',description:'T-shirt',quantity:10,delivered:4,remaining:6}]);});
describe('invoice delivery flow',()=>{
 it('hides creation for read-only user',async()=>{render(<InvoiceDelivery invoice={invoice} company={null} canCreate={false}/>);await waitFor(()=>expect(api.invoiceDeliveryBalance).toHaveBeenCalled());expect(screen.queryByText('Créer un bon de livraison')).toBeNull()});
 it('shows remaining quantity and prevents empty submission',async()=>{render(<InvoiceDelivery invoice={invoice} company={null} canCreate/>);fireEvent.click(screen.getByText('Créer un bon de livraison'));const qty=await screen.findByLabelText('Quantité livrée : T-shirt');expect(qty.getAttribute('max')).toBe('6');fireEvent.change(qty,{target:{value:'0'}});fireEvent.click(screen.getByText('Confirmer les quantités livrées et générer le bon'));expect(await screen.findByRole('alert')).toHaveProperty('textContent','Sélectionnez au moins un article en renseignant sa quantité livrée.');expect(api.createDeliveryFromInvoice).not.toHaveBeenCalled()});
 it('sends selected invoice item and keeps form open on server rejection',async()=>{api.createDeliveryFromInvoice.mockRejectedValue(new Error('Quantité livrée supérieure au restant de la facture'));render(<InvoiceDelivery invoice={invoice} company={null} canCreate/>);fireEvent.click(screen.getByText('Créer un bon de livraison'));const qty=await screen.findByLabelText('Quantité livrée : T-shirt');fireEvent.change(qty,{target:{value:'2'}});fireEvent.click(screen.getByText('Confirmer les quantités livrées et générer le bon'));await waitFor(()=>expect(api.createDeliveryFromInvoice).toHaveBeenCalledWith('invoice',[{invoice_item_id:'line',quantity:2}],expect.any(String),'',expect.any(String)));expect(await screen.findByRole('alert')).toHaveProperty('textContent','Quantité livrée supérieure au restant de la facture');expect(screen.getByLabelText('Quantité livrée : T-shirt')).toBeTruthy()});
});
