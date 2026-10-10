import {afterEach,describe,expect,it,vi} from 'vitest';
import {createGoogleEvent} from '../supabase/functions/_shared/google-calendar';
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
