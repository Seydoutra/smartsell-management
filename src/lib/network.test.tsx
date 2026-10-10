// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {act,cleanup,renderHook,waitFor} from '@testing-library/react'
import {useOnlineStatus} from './network'
import {CHECK_CONNECTION,NETWORK_AVAILABLE,checkServerReachability} from './connectivity'
beforeEach(()=>{vi.restoreAllMocks();Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'})})
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals()})
describe('platform connectivity',()=>{
 it('does not trust a false browser offline flag when the platform responds',async()=>{
  vi.spyOn(navigator,'onLine','get').mockReturnValue(false)
  const probe=vi.fn().mockResolvedValue(true)
  const {result}=renderHook(()=>useOnlineStatus(probe))
  await waitFor(()=>expect(probe).toHaveBeenCalledTimes(1));expect(result.current).toBe(true)
  act(()=>window.dispatchEvent(new Event('offline')))
  await waitFor(()=>expect(probe).toHaveBeenCalledTimes(2));expect(result.current).toBe(true)
 })
 it('detects a real failure and rechecks when returning to the app',async()=>{
  const probe=vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
  const {result}=renderHook(()=>useOnlineStatus(probe))
  await waitFor(()=>expect(result.current).toBe(false))
  act(()=>window.dispatchEvent(new Event('focus')))
  await waitFor(()=>expect(result.current).toBe(true))
 })
 it('does not let a late failed probe overwrite a successful API response',async()=>{
  let resolve!:(value:boolean)=>void;const probe=vi.fn(()=>new Promise<boolean>(r=>{resolve=r}))
  const {result}=renderHook(()=>useOnlineStatus(probe))
  act(()=>window.dispatchEvent(new Event(NETWORK_AVAILABLE)))
  await act(async()=>resolve(false));expect(result.current).toBe(true)
 })
 it('supports manual checking and stops polling after unmount',async()=>{
  vi.useFakeTimers();const probe=vi.fn().mockResolvedValue(true)
  const {unmount}=renderHook(()=>useOnlineStatus(probe));await act(async()=>{})
  act(()=>window.dispatchEvent(new Event(CHECK_CONNECTION)));await act(async()=>{})
  expect(probe).toHaveBeenCalledTimes(2)
  await act(async()=>vi.advanceTimersByTime(60000));expect(probe).toHaveBeenCalledTimes(3)
  unmount();await act(async()=>vi.advanceTimersByTime(60000));expect(probe).toHaveBeenCalledTimes(3)
 })
 it('does not mislabel an HTTP authentication error as a network outage',async()=>{
  const fetcher=vi.fn().mockResolvedValue({status:401});vi.stubGlobal('fetch',fetcher)
  expect(await checkServerReachability('https://example.supabase.co','public-test-key')).toBe(true)
  expect(fetcher).toHaveBeenCalledWith('https://example.supabase.co/auth/v1/health',expect.objectContaining({method:'HEAD',cache:'no-store',credentials:'omit'}))
 })
 it('returns offline on a failed network request',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
  expect(await checkServerReachability('https://example.supabase.co')).toBe(false)
 })
})
