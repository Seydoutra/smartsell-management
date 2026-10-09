// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {act,cleanup,renderHook,waitFor} from '@testing-library/react'
const api=vi.hoisted(()=>({load:vi.fn()}))
vi.mock('./repository',()=>({getAccessControl:api.load}))
import {useLiveAccess} from './useLiveAccess'
beforeEach(()=>vi.resetAllMocks());afterEach(()=>{cleanup();vi.useRealTimers()})
describe('live permissions',()=>{
 it('refreshes revoked actions on focus and fails closed on error',async()=>{
  api.load.mockResolvedValue({profile_id:'A',allowed_modules:['Clients'],denied_permissions:[]});
  const {result}=renderHook(()=>useLiveAccess('A'));await waitFor(()=>expect(result.current.accessLoaded).toBe(true));
  api.load.mockResolvedValue({profile_id:'A',allowed_modules:['Clients'],denied_permissions:['clients.delete']});
  act(()=>window.dispatchEvent(new Event('focus')));await waitFor(()=>expect(result.current.access?.denied_permissions).toEqual(['clients.delete']));
  api.load.mockRejectedValue(new Error('offline'));act(()=>window.dispatchEvent(new Event('focus')));await waitFor(()=>expect(result.current.access).toBeNull());
 });
 it('never shows the previous account permissions when switching accounts',async()=>{
  api.load.mockResolvedValue({profile_id:'A',allowed_modules:['Clients'],denied_permissions:[]});
  const {result,rerender}=renderHook(({id})=>useLiveAccess(id),{initialProps:{id:'A'}});await waitFor(()=>expect(result.current.accessLoaded).toBe(true));
  let resolve!:(value:unknown)=>void;api.load.mockImplementation(()=>new Promise(r=>{resolve=r}));rerender({id:'B'});
  expect(result.current.access).toBeNull();expect(result.current.accessLoaded).toBe(false);
  await act(async()=>resolve({profile_id:'B',allowed_modules:[],denied_permissions:[]}));expect(result.current.access?.profile_id).toBe('B');
 });
 it('polls active sessions and stops polling after unmount',async()=>{
  vi.useFakeTimers();api.load.mockResolvedValue(null);const {unmount}=renderHook(()=>useLiveAccess('A'));
  await act(async()=>{});expect(api.load).toHaveBeenCalledTimes(1);
  await act(async()=>vi.advanceTimersByTime(15000));expect(api.load).toHaveBeenCalledTimes(2);
  unmount();await act(async()=>vi.advanceTimersByTime(15000));expect(api.load).toHaveBeenCalledTimes(2);
 });
})
