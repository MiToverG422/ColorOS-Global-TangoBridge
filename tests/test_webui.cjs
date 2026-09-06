const {test}=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const I=require('../module/webroot/i18n.js');
const H=require('../module/webroot/health.js');
const M=require('../module/webroot/monitor-core.js');
function harness(hash){
 const nodes=new Map(),events={},calls=[];
 function node(){return {hidden:false,disabled:false,value:'startup',textContent:'',children:[],writes:0,
  classList:{add(){},remove(){}},addEventListener(k,f){this[k]=f},focus(){},setAttribute(){},removeAttribute(){},
  append(...v){this.children.push(...v)},replaceChildren(...v){this.children=v;this.writes++}};}
 const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)};
 const ctx={TangoI18n:I,TangoHealth:H,TangoMonitor:M,console,TextDecoder,Uint8Array,atob,Event,
  location:{hash},navigator:{},setTimeout,clearTimeout,scrollTo(){},
  matchMedia:()=>({addEventListener(){}}),getComputedStyle:()=>({getPropertyValue:()=> '#fff'}),
  document:{hidden:false,documentElement:{lang:'',classList:{add(){},remove(){}}},
   getElementById:get,createElement:node,querySelectorAll:()=>[],querySelector:get,addEventListener(){}},
  addEventListener(k,f){(events[k]??=[]).push(f)},dispatchEvent(e){for(const f of events[e.type]||[])f()},
  ksu:{fullScreen(){},exec(command,options,callback){calls.push(command);ctx[callback](1,'')}}};
 ctx.window=ctx;vm.createContext(ctx);
 return {ctx,get,calls,events,run(file){vm.runInContext(fs.readFileSync('module/webroot/'+file,'utf8'),ctx)}};
}
test('settings and monitoring entry skip expensive diagnosis until a data page is opened',async()=>{
 for(const hash of ['#settings','#monitor']){
  const h=harness(hash);h.run('app.js');assert.equal(h.calls.length,0);
  h.ctx.location.hash='#checks';h.ctx.dispatchEvent(new Event('hashchange'));
  assert.equal(h.calls.length,1);assert.match(h.calls[0],/diagnose.sh/);
  await new Promise(setImmediate);
  h.ctx.dispatchEvent(new Event('hashchange'));assert.equal(h.calls.length,1);
  assert.equal(h.get('passed-box').hidden,true);
 }
});
test('unchanged process data does not recreate the process list; stale data clears it',()=>{
 const h=harness('#settings');let receive;
 h.ctx.TangoMonitor={...M,poller(options){receive=options.receive;return {setActive(){}}}};
 h.run('monitor.js');
 const data={enabled:1,fresh:true,sampled:100,snapshot:{found:1,service:'running',count:1,rss:100,processes:[{pid:10,rss:100,name:'zygote'}]}};
 receive(data);const writes=h.get('monitor-processes').writes;
 receive({...data,sampled:101});assert.equal(h.get('monitor-processes').writes,writes);
 receive({...data,fresh:false});assert.equal(h.get('monitor-processes').writes,writes+1);
});
