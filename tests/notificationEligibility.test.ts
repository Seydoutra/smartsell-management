import { describe, expect, it } from 'vitest';
import { automatedRecipientEligible, notificationProfileEligible } from '../supabase/functions/_shared/notificationEligibility';
describe('Automated notification eligibility', () => {
  it('rejects inactive, sandbox, client, invalid and expired accounts', () => {
    for (const p of [null, {active:false}, {active:true,is_beta_tester:true}, {active:true,role:'CLIENT'}, {active:true,roles:['CLIENT','ADMIN']}, {active:true,access_expires_at:'invalid'}, {active:true,access_expires_at:'2020-01-01'}]) expect(notificationProfileEligible(p)).toBe(false);
    expect(notificationProfileEligible({active:true})).toBe(true);
  });
  it('blocks a valid collaborator when the workspace owner is expired or foreign', async () => {
    let rows = [{id:'member',tenant_owner_id:'owner',active:true}, {id:'owner',active:true,access_expires_at:'2020-01-01'}];
    const admin = {from:()=>({select:()=>({in:async()=>({data:rows})})})};
    expect(await automatedRecipientEligible(admin,'member','owner')).toBe(false);
    rows = [{id:'member',tenant_owner_id:'foreign',active:true}, {id:'owner',active:true}];
    expect(await automatedRecipientEligible(admin,'member','owner')).toBe(false);
    rows[0].tenant_owner_id='owner';
    expect(await automatedRecipientEligible(admin,'member','owner')).toBe(true);
  });
});
