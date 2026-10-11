import {afterEach,describe,expect,it,vi} from 'vitest';
import {createGoogleEvent,updateGoogleEvent,deleteGoogleEvent} from '../supabase/functions/_shared/google-calendar';
const taskId='82d342ff-6b0f-4060-8b1e-08ffa00e849f';
const eventId='sm82d342ff6b0f40608b1e08ffa00e849f';
const event={taskId,title:'TEST',start:'2026-10-11T10:00:00Z',reminderMinutes:30};
afterEach(()=>vi.unstubAllGlobals());
describe('Google Calendar retry safety',()=>{
  it('uses a stable event ID for the task',async()=>{
    const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({id:eventId}),{status:200}));
    vi.stubGlobal('fetch',fetchMock);
    expect(await createGoogleEvent('test','primary',event)).toBe(eventId);
    const payload=JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.id).toBe(eventId);
    expect(payload.extendedProperties.private.taskId).toBe(taskId);
  });
  it('recovers an already created event without duplicating it',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response('{}',{status:409})).mockResolvedValueOnce(new Response(JSON.stringify({id:eventId,extendedProperties:{private:{source:'smartsell',taskId}}}),{status:200})));
    expect(await createGoogleEvent('test','primary',event)).toBe(eventId);
  });
  it('refuses an unrelated conflicting event',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response('{}',{status:409})).mockResolvedValueOnce(new Response(JSON.stringify({id:eventId}),{status:200})));
    await expect(createGoogleEvent('test','primary',event)).rejects.toThrow('non reconnu');
  });
});
describe('Google Calendar lifecycle',()=>{
 const owned={id:eventId,etag:'version-1',extendedProperties:{private:{source:'smartsell',taskId}}};
 it('updates the same owned event after a title or date edit',async()=>{
  const fetchMock=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(owned),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify(owned),{status:200}));vi.stubGlobal('fetch',fetchMock);
  await updateGoogleEvent('test','primary',eventId,{...event,title:'Modifiée'});
  expect(fetchMock.mock.calls[1][1].method).toBe('PATCH');
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).summary).toBe('Modifiée');
  expect(fetchMock.mock.calls[1][1].headers['if-match']).toBe('version-1');
 });
 it('deletes only an event identified as this Smartsell task',async()=>{
  const fetchMock=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(owned),{status:200})).mockResolvedValueOnce(new Response(null,{status:204}));vi.stubGlobal('fetch',fetchMock);
  await deleteGoogleEvent('test','primary',eventId,taskId);
  expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
 });
 it('treats an already deleted event as successfully removed',async()=>{
  const fetchMock=vi.fn().mockResolvedValue(new Response('{}',{status:410}));vi.stubGlobal('fetch',fetchMock);
  await deleteGoogleEvent('test','primary',eventId,taskId);expect(fetchMock).toHaveBeenCalledTimes(1);
 });
 it('refuses to delete an unrelated calendar event',async()=>{
  const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({id:eventId}),{status:200}));vi.stubGlobal('fetch',fetchMock);
  await expect(deleteGoogleEvent('test','primary',eventId,taskId)).rejects.toThrow('non reconnu');expect(fetchMock).toHaveBeenCalledTimes(1);
 });
 it('does not report a failed deletion as successful',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(owned),{status:200})).mockResolvedValueOnce(new Response('{}',{status:503})));
  await expect(deleteGoogleEvent('test','primary',eventId,taskId)).rejects.toThrow('503');
 });
});
