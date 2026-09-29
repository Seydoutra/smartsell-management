import { afterEach, describe, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({rpc:vi.fn(),single:vi.fn(),maybeSingle:vi.fn()}))
vi.mock('../supabase/functions/_shared/http.ts',()=>({adminClient:()=>({rpc:mocks.rpc,from:()=>({select:()=>({eq:()=>({single:mocks.single,maybeSingle:mocks.maybeSingle})})})})}))
import { sendNimbaSms } from '../supabase/functions/_shared/nimba'
afterEach(()=>{vi.unstubAllGlobals();vi.resetAllMocks()})
function setup(){vi.stubGlobal('Deno',{env:{get:(key:string)=>({NIMBA_SERVICE_ID:'platform',NIMBA_SECRET_TOKEN:'platform-secret',NIMBA_SENDER_NAME:'SMARTSELL'}[key])}});const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({id:'message'})});vi.stubGlobal('fetch',fetcher);return fetcher}
describe('Tenant SMS routing',()=>{
 it('uses the selected tenant credentials and sender',async()=>{const fetcher=setup();mocks.rpc.mockResolvedValue({data:[{service_id:'tenant',secret_token:'tenant-secret',sender_name:'CLIENT'}]});await sendNimbaSms(['620123456'],'Test','tenant-id');expect(mocks.rpc).toHaveBeenCalledWith('get_tenant_sms_credentials',{p_tenant:'tenant-id'});const init=fetcher.mock.calls[0][1];expect(init.headers.authorization).toBe('Basic '+btoa('tenant:tenant-secret'));expect(JSON.parse(init.body).sender_name).toBe('CLIENT')})
 it('does not use platform credits for an unconfigured tenant',async()=>{const fetcher=setup();mocks.rpc.mockResolvedValue({data:[]});mocks.single.mockResolvedValue({data:{is_platform_owner:false}});mocks.maybeSingle.mockResolvedValue({data:null});await expect(sendNimbaSms(['620123456'],'Test','tenant-id')).rejects.toThrow('SMS non activés');expect(fetcher).not.toHaveBeenCalled()})
 it('blocks a paused configuration even for the platform owner',async()=>{const fetcher=setup();mocks.rpc.mockResolvedValue({data:[]});mocks.single.mockResolvedValue({data:{is_platform_owner:true}});mocks.maybeSingle.mockResolvedValue({data:{status:'PAUSED'}});await expect(sendNimbaSms(['620123456'],'Test','owner')).rejects.toThrow('SMS non activés');expect(fetcher).not.toHaveBeenCalled()})
 it('keeps platform OTP on the platform sender',async()=>{const fetcher=setup();await sendNimbaSms(['620123456'],'OTP');expect(mocks.rpc).not.toHaveBeenCalled();expect(JSON.parse(fetcher.mock.calls[0][1].body).sender_name).toBe('SMARTSELL')})
})
