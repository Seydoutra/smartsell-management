// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,waitFor,act} from '@testing-library/react'
const api=vi.hoisted(()=>({list:vi.fn(),get:vi.fn(),save:vi.fn()}))
vi.mock('./services/repository',async importOriginal=>({...await importOriginal<object>(),listProfiles:api.list,getAccessControl:api.get,saveTeamAccess:api.save}))
import {TeamAccessPage} from './AdvancedModulesV3'
const profile={id:'user',tenant_owner_id:'owner',full_name:'Test Collaborateur',role:'ADMIN',roles:['ADMIN'],active:true};
const access={profile_id:'user',allowed_modules:['Clients'],denied_permissions:[],can_initiate_calls:false,max_sms_per_day:1,max_emails_per_day:1,max_calls_per_day:1,max_export_rows:1,max_approval_amount:0};
beforeEach(()=>{vi.resetAllMocks();api.list.mockResolvedValue([profile]);api.get.mockResolvedValue(access)});afterEach(cleanup);
async function open(){render(<TeamAccessPage admin={true} canManage={true} tenantOwnerId="owner"/>);fireEvent.click(await screen.findByRole('button',{name:/Test Collaborateur/}));await screen.findByRole('button',{name:'Enregistrer les rôles et droits'})}
describe('permission editor',()=>{
 it('uses one atomic save and does not announce success on failure',async()=>{
  api.save.mockRejectedValue(new Error('Sauvegarde refusée'));await open();
  const clients=document.querySelector('.permission-matrix section')!;fireEvent.click(clients.querySelectorAll('input')[3]);
  fireEvent.click(screen.getByRole('button',{name:'Enregistrer les rôles et droits'}));await screen.findByText('Sauvegarde refusée');
  expect(api.save).toHaveBeenCalledWith(expect.objectContaining({profile_id:'user',denied_permissions:['clients.delete']}),['ADMIN']);expect(screen.queryByText('Rôles et droits enregistrés et appliqués.')).toBeNull();
 });
 it('shows success only after a confirmed save',async()=>{
  let resolve!:(value:unknown)=>void;api.save.mockImplementation(()=>new Promise(r=>{resolve=r}));await open();fireEvent.click(screen.getByRole('button',{name:'Enregistrer les rôles et droits'}));
  expect(screen.queryByText('Rôles et droits enregistrés et appliqués.')).toBeNull();expect(screen.getByRole('button',{name:'Enregistrer les rôles et droits'}).matches(':disabled')).toBe(true);
  await act(async()=>resolve(access));await screen.findByText('Rôles et droits enregistrés et appliqués.');
 });
 it('defaults to no module when no rights record exists',async()=>{
  api.get.mockResolvedValue(null);await open();expect([...document.querySelectorAll('.module-rights input')].some(input=>(input as HTMLInputElement).checked)).toBe(false);
 });
 it('prevents editing when team.update is withdrawn',async()=>{
  render(<TeamAccessPage admin={false} canManage={false} tenantOwnerId="owner"/>);fireEvent.click(await screen.findByRole('button',{name:/Test Collaborateur/}));await waitFor(()=>expect(screen.getByRole('button',{name:'Enregistrer les rôles et droits'}).matches(':disabled')).toBe(true));expect(document.querySelector('.role-options input')?.matches(':disabled')).toBe(true);
 });
})
