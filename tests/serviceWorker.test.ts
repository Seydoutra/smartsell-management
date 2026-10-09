import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const source=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8')
function worker({saved,legacy,network=new Response('module',{status:200})}:{saved?:Response;legacy?:Response;network?:Response}={}){
  const listeners:Record<string,(event:any)=>void>={}
  const put=vi.fn(),fetch=vi.fn(async()=>network),claim=vi.fn(),remove=vi.fn()
  const cache={match:vi.fn(async()=>saved),put,addAll:vi.fn(async()=>{})}
  runInNewContext(source,{URL,Response,fetch,caches:{open:async()=>cache,match:async()=>legacy,delete:remove},self:{location:{origin:'https://example.test'},clients:{claim},skipWaiting:vi.fn(),addEventListener:(name:string,callback:any)=>{listeners[name]=callback}}})
  async function request(path:string,mode='cors'){
    let result:Promise<Response>|undefined
    listeners.fetch({request:{url:`https://example.test${path}`,method:'GET',mode},respondWith:(value:Promise<Response>)=>{result=value}})
    return result
  }
  return {listeners,request,put,fetch,claim,remove}
}
describe('application cache across releases',()=>{
  it('keeps a previously loaded hashed JavaScript usable when the server no longer has it',async()=>{
    const w=worker({legacy:new Response('old module'),network:new Response('not found',{status:404})})
    expect(await (await w.request('/smartsell-management/assets/pdf-old.js'))?.text()).toBe('old module')
    expect(w.fetch).not.toHaveBeenCalled()
  })
  it('does not reuse or cache a missing JavaScript response',async()=>{
    const w=worker({saved:new Response('not found',{status:404}),legacy:new Response('not found',{status:404}),network:new Response('not found',{status:404})})
    expect((await w.request('/smartsell-management/assets/missing.js'))?.status).toBe(404)
    expect(w.put).not.toHaveBeenCalled()
  })
  it('caches successful public assets',async()=>{
    const w=worker()
    expect((await w.request('/smartsell-management/assets/current.js'))?.status).toBe(200)
    expect(w.put).toHaveBeenCalledOnce()
  })
  it('does not cache API data or unrelated apps',async()=>{
    const w=worker()
    expect(await w.request('/smartsell-management/api/private')).toBeUndefined()
    expect(await w.request('/another-app/assets/current.js')).toBeUndefined()
    expect(w.fetch).not.toHaveBeenCalled()
  })
  it('does not delete caches belonging to other applications',async()=>{
    const w=worker();let done:Promise<unknown>|undefined
    w.listeners.activate({waitUntil:(value:Promise<unknown>)=>{done=value}});await done
    expect(w.claim).toHaveBeenCalledOnce();expect(w.remove).not.toHaveBeenCalled()
  })
})
