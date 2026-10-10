import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.argv[2]);
const db=new PGlite();
for(const table of ['task_assignment_sms','project_assignment_sms','task_reminder_schedule']) await db.exec(`create table ${table}(id uuid primary key,status text default 'PENDING' check(status in ('PENDING','SENT','FAILED','CANCELLED')))`);
const sql=await readFile('supabase/v79_reminder_dispatch_claims.sql','utf8');
await db.exec(sql); await db.exec(sql);
for(const table of ['task_assignment_sms','project_assignment_sms','task_reminder_schedule']) {
  const id='00000000-0000-0000-0000-000000000001';
  await db.query(`insert into ${table}(id) values($1)`,[id]);
  const claim=()=>db.query(`update ${table} set status='PROCESSING' where id=$1 and status='PENDING' returning id`,[id]);
  const claims=await Promise.all([claim(),claim()]);
  assert.equal(claims.reduce((n,r)=>n+r.rows.length,0),1);
  assert.equal((await claim()).rows.length,0);
  await db.query(`update ${table} set status='SENT' where id=$1`,[id]);
  assert.equal((await claim()).rows.length,0);
}
await db.close();
console.log('PASS: migrations réapplicables et une seule réservation par rappel, même avec deux travailleurs.');
