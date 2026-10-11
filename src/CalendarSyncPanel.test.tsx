// @vitest-environment jsdom
import {afterEach,describe,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
const api=vi.hoisted(()=>({action:vi.fn(),connect:vi.fn(),resolve:vi.fn()}));
vi.mock('./services/repository',()=>({calendarSyncAction:api.action,connectGoogleCalendar:api.connect,resolveCalendarLink:api.resolve}));
import CalendarSyncPanel from './CalendarSyncPanel';
afterEach(()=>{cleanup();vi.resetAllMocks();});
const connected={connection:{connected:true,calendar_email:'test@example.com',sync_enabled:true,inbound_enabled:false},links:[]};
describe('Own calendar interface',()=>{
 it('waits before announcing connection status',()=>{api.action.mockReturnValue(new Promise(()=>{}));render(<CalendarSyncPanel onChanged={()=>{}}/>);expect(screen.getByRole('status')).toBeTruthy();expect(screen.queryByText('Connecter Google Agenda')).toBeNull();});
 it('offers connection only after status confirms none',async()=>{api.action.mockResolvedValue({connection:null,links:[]});render(<CalendarSyncPanel onChanged={()=>{}}/>);expect(await screen.findByText('Connecter Google Agenda')).toBeTruthy();});
 it('synchronizes from the interface and reports results',async()=>{api.action.mockImplementation((a:string)=>Promise.resolve(a==='sync'?{synced:2,imported:1,conflicts:0,failed:0}:connected));const changed=vi.fn();render(<CalendarSyncPanel onChanged={changed}/>);fireEvent.click(await screen.findByText('Synchroniser maintenant'));await screen.findByText(/2 envoi/);expect(api.action).toHaveBeenCalledWith('sync');expect(changed).toHaveBeenCalled();});
 it('makes inbound changes opt-in',async()=>{api.action.mockResolvedValue(connected);render(<CalendarSyncPanel onChanged={()=>{}}/>);const checkbox=await screen.findByRole('checkbox');expect((checkbox as HTMLInputElement).checked).toBe(false);fireEvent.click(checkbox);await waitFor(()=>expect(api.action).toHaveBeenCalledWith('settings',{inbound_enabled:true}));});
 it('shows suppression without deleting the shared task',async()=>{api.action.mockResolvedValue({...connected,links:[{task_id:'a',suppressed:true,conflict:null,error:null,tasks:{title:'Mission'}}]});render(<CalendarSyncPanel onChanged={()=>{}}/>);expect(await screen.findByText('Remettre dans mon agenda')).toBeTruthy();expect(screen.queryByText('Supprimer la tâche')).toBeNull();});
});
