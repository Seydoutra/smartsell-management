// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {NETWORK_AVAILABLE,NETWORK_FAILURE} from '../lib/connectivity'
const api=vi.hoisted(()=>({create:vi.fn(()=>({}))}))
vi.mock('@supabase/supabase-js',()=>({createClient:api.create}))
let request:typeof fetch
beforeEach(async()=>{
 vi.resetModules();vi.clearAllMocks()
 vi.stubEnv('VITE_DEMO_MODE','false');vi.stubEnv('VITE_SUPABASE_URL','https://example.supabase.co');vi.stubEnv('VITE_SUPABASE_ANON_KEY','public-test')
 await import('./supabase')
 request=(api.create.mock.calls[0] as unknown as [string,string,{global:{fetch:typeof fetch}}])[2].global.fetch
})
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs()})
describe('API connection evidence',()=>{
 it('reports an HTTP response as reachable without hiding the server error',async()=>{
  const response={status:403};vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response));const events=vi.spyOn(window,'dispatchEvent')
  expect(await request('https://example.supabase.co/rest/v1/profiles')).toBe(response)
  expect(events.mock.calls.map(([event])=>event.type)).toEqual([NETWORK_AVAILABLE])
 })
 it('reports a network failure but propagates the original error',async()=>{
  const error=new TypeError('Failed to fetch');vi.stubGlobal('fetch',vi.fn().mockRejectedValue(error));const events=vi.spyOn(window,'dispatchEvent')
  await expect(request('https://example.supabase.co/rest/v1/profiles')).rejects.toBe(error)
  expect(events.mock.calls.map(([event])=>event.type)).toEqual([NETWORK_FAILURE])
 })
 it('does not turn an intentionally aborted request into a connectivity failure',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new DOMException('Cancelled','AbortError')));const events=vi.spyOn(window,'dispatchEvent')
  await expect(request('https://example.supabase.co/rest/v1/profiles')).rejects.toThrow('Cancelled')
  expect(events).not.toHaveBeenCalled()
 })
})
