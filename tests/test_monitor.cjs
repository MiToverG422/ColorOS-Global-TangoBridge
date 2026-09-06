const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../module/webroot/monitor-core.js');
const sample='TANGO_MONITOR\t1\nSERVICE\trunning\nROOT\t10\nPROCESS\t10\t1\t1024\tzygote\nPROCESS\t11\t10\t2048\t<app>\nSUMMARY\t1\t2\t3072\nEND\t1';
const wrap=(time=100,enabled=1)=>`CONTROL\t1\nENABLED\t${enabled}\nNOW\t${time}\nSAMPLED\t100\nAVAILABLE\t1\n${sample}`;
test('snapshot protocol rejects truncation and invalid counts',()=>{
 assert.equal(M.parse(sample).count,2);assert.equal(M.parse(sample).processes[1].name,'<app>');
 for(const bad of [sample.slice(0,-2),sample.replace('SUMMARY\t1\t2','SUMMARY\t1\t3'),sample.replace('1024','NaN'),sample.replace('ROOT\t10','ROOT\t9007199254740992')])assert.throws(()=>M.parse(bad));
});
test('cache status distinguishes stale, future, disabled and missing data',()=>{
 assert.equal(M.status(wrap(130)).fresh,true);assert.equal(M.status(wrap(131)).fresh,false);
 assert.equal(M.status(wrap(99)).fresh,false);assert.equal(M.status(wrap(100,0)).enabled,0);
 assert.equal(M.status('CONTROL\t1\nENABLED\t0\nNOW\t100\nSAMPLED\t0\nAVAILABLE\t0').snapshot,null);
 assert.throws(()=>M.status(wrap(100,2)));assert.throws(()=>M.status(wrap().replace('AVAILABLE\t1','AVAILABLE\t0')));
});
test('UI polling never overlaps and discards results after leaving the page',async()=>{
 let finish,reads=0,received=0,queue=[];
 const p=M.poller({read:()=>{reads++;return new Promise(r=>finish=r)},receive:()=>received++,fail:()=>assert.fail(),schedule:(fn)=>{queue.push(fn);return fn},cancel:fn=>{queue=queue.filter(f=>f!==fn)}});
 p.setActive(true);p.setActive(true);assert.equal(reads,1);
 p.setActive(false);p.setActive(true);assert.equal(reads,1);finish({});await new Promise(setImmediate);
 assert.equal(received,0);assert.equal(queue.length,1);queue.shift()();assert.equal(reads,2);
 finish({});await new Promise(setImmediate);assert.equal(received,1);p.setActive(false);assert.equal(queue.length,0);
});
test('monotonic cache freshness survives wall-clock corrections',()=>{
 const wrap2=(now,uptime,sampled=100,sampleUptime=50)=>`CONTROL\t2\nENABLED\t1\nNOW\t${now}\nUPTIME\t${uptime}\nSAMPLED\t${sampled}\nSAMPLE_UPTIME\t${sampleUptime}\nAVAILABLE\t1\n${sample}`;
 assert.equal(M.status(wrap2(1,60)).fresh,true); // clock set backwards
 assert.equal(M.status(wrap2(900000,60)).fresh,true); // clock set forwards
 assert.equal(M.status(wrap2(100,80)).fresh,true);
 assert.equal(M.status(wrap2(100,81)).fresh,false);
 assert.equal(M.status(wrap2(100,49)).fresh,false);
 assert.throws(()=>M.status(wrap2(100,60).replace('UPTIME\t60','UPTIME\t-1')));
 assert.throws(()=>M.status(wrap2(100,60).replace('SAMPLE_UPTIME\t50\n','')));
});
test('returning during an old request triggers an immediate replacement read',async()=>{
 let finish,received=0,scheduled=[];
 const p=M.poller({read:()=>new Promise(r=>finish=r),receive:()=>received++,fail:()=>assert.fail(),schedule:(fn,delay)=>{scheduled.push({fn,delay});return fn},cancel:()=>{}});
 p.setActive(true);p.setActive(false);p.setActive(true);finish({});await new Promise(setImmediate);
 assert.equal(received,0);assert.equal(scheduled.length,1);assert.equal(scheduled[0].delay,0);
 p.setActive(false);
});

test('network progress is optional for legacy samples and validated when present',()=>{
  const base='TANGO_MONITOR\t1\nSERVICE\tstopped\nROOT\t0\nSUMMARY\t0\t0\t0\nEND\t1';
  const parse=require('../module/webroot/monitor-core.js').parse;
  assert.equal(parse(base).network,undefined);
  const value=base.replace('SERVICE','NETWORK\tgenerating\tnone\t2\nSERVICE');
  assert.deepEqual(parse(value).network,{stage:'generating',reason:'none',seconds:2});
  assert.throws(()=>parse(value.replace('none\t2','none\t-1')));
});
