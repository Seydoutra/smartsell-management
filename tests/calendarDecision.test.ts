import {describe,it,expect} from 'vitest';
import {remoteChanged} from '../supabase/functions/_shared/calendar-decision';
describe('Calendar inbound snapshot',()=>{
 it('ignores equivalent timezone representations',()=>expect(remoteChanged({title:'Mission',start:'2026-10-12T12:00:00Z'},{summary:'Mission',start:{dateTime:'2026-10-12T13:00:00+01:00'}})).toBe(false));
 it('detects title change',()=>expect(remoteChanged({title:'Mission',start:'2026-10-12T12:00:00Z'},{summary:'Nouvelle mission',start:{dateTime:'2026-10-12T12:00:00Z'}})).toBe(true));
 it('detects time change',()=>expect(remoteChanged({title:'Mission',start:'2026-10-12T12:00:00Z'},{summary:'Mission',start:{dateTime:'2026-10-12T14:00:00Z'}})).toBe(true));
 it('does not silently convert all-day events',()=>expect(remoteChanged({title:'Mission',start:'2026-10-12T12:00:00Z'},{summary:'Mission',start:{}})).toBe(true));
});
