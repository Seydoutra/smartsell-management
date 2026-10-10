// Operator utility: existing local Supabase CLI session, never log credentials.
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {homedir} from 'node:os';
import {join} from 'node:path';
const token=(await readFile(join(homedir(),'.supabase','access-token'),'utf8')).trim();
const root='https://api.supabase.com/v1/projects/insqsizvcbvgfysqlxte';
const mode=process.argv[2];
const headers={authorization:`Bearer ${token}`};
function queryDatabase(query){
 const r=spawnSync('curl',['--silent','--show-error','--fail-with-body','--max-time','45','--config','-','--request','POST','--header','content-type: application/json','--data-binary',JSON.stringify({query}),root+'/database/query'],{input:`header = "Authorization: Bearer ${token}"\n`,encoding:'utf8'});
 if(r.status!==0)throw new Error(r.stdout||r.stderr||'API connection failed');return r.stdout;
}
if(mode==='query'){
 console.log(queryDatabase(process.argv[3]));
}else if(mode==='migrate'){
 const file=process.argv[3];if(!/^supabase\/v7[12]_equipment_[a-z_]+\.sql$/.test(file)&&file!=='supabase/v74_goal_cockpit.sql')throw new Error('Unexpected migration target');
 queryDatabase(await readFile(file,'utf8'));console.log('Migration applied:',file);
}else if(mode==='deploy'){
 const slug='equipment-decision-notify';
 const sources=await Promise.all(['_shared/http.ts','_shared/trialSms.ts','_shared/nimba.ts',slug+'/index.ts'].map(p=>readFile('supabase/functions/'+p,'utf8')));
 const source=sources.map(s=>s.replace(/^import .*from ["'][.][.\/].*["'];?\s*$/gm,'')).join('\n');
 // This cron-only worker checks CRON_SECRET/service role itself; no user endpoint.
 const form=new FormData();form.append('metadata',JSON.stringify({name:slug,entrypoint_path:'index.ts',verify_jwt:false}));form.append('file',new Blob([source],{type:'application/typescript'}),'index.ts');
 const response=await fetch(root+'/functions/deploy?slug='+slug,{method:'POST',headers,body:form});
 if(!response.ok)throw new Error(`${response.status} ${await response.text()}`);const data=await response.json();console.log(JSON.stringify({slug:data.slug,status:data.status,version:data.version}));
}else throw new Error('query, migrate or deploy required');
