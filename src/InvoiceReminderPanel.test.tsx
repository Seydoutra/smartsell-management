// @vitest-environment jsdom
import {describe,it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,fireEvent,waitFor} from '@testing-library/react';
const api=vi.hoisted(()=>({list:vi.fn(),set:vi.fn()}));
vi.mock('./services/repository',()=>({listInvoiceReminders:api.list,setInvoiceReminders:api.set}));
import InvoiceReminderPanel from './InvoiceReminderPanel';
import type {Invoice} from './types/models';
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.clearAllMocks();});
const invoices=[{id:'a',number:'FAC-1',sms_reminders_enabled:false,clients:{name:'Client'}}] as Invoice[];
describe('Invoice reminder controls',()=>{
 it('respects management rights',async()=>{api.list.mockResolvedValue([]);render(<InvoiceReminderPanel invoices={invoices} canManage={false} onChanged={()=>{}}/>);fireEvent.change(screen.getByRole('combobox'),{target:{value:'a'}});await screen.findByText('Relances : désactivées');expect(screen.queryByRole('button',{name:'Activer les relances SMS'})).toBeNull();});
 it('requires confirmation before activation',async()=>{api.list.mockResolvedValue([]);api.set.mockResolvedValue(undefined);vi.spyOn(window,'confirm').mockReturnValue(true);const changed=vi.fn();render(<InvoiceReminderPanel invoices={invoices} canManage onChanged={changed}/>);fireEvent.change(screen.getByRole('combobox'),{target:{value:'a'}});fireEvent.click(await screen.findByText('Activer les relances SMS'));await waitFor(()=>expect(api.set).toHaveBeenCalledWith('a',true));expect(changed).toHaveBeenCalled();});
 it('distinguishes provider acceptance from delivery',async()=>{api.list.mockResolvedValue([{id:'job',step:1,scheduled_for:'2026-10-30T09:00:00Z',status:'SENT',error:null}]);render(<InvoiceReminderPanel invoices={invoices} canManage onChanged={()=>{}}/>);fireEvent.change(screen.getByRole('combobox'),{target:{value:'a'}});expect(await screen.findByText(/Accepté par le prestataire/)).toBeTruthy();});
});
