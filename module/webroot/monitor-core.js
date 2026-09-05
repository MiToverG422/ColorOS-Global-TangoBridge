/* SPDX-License-Identifier: GPL-3.0-only */
(function(root){
  'use strict';
  function parse(text){
    const lines=text.trim().split(/\r?\n/).map(l=>l.split('\t'));
    if(lines[0]?.join('\t')!=='TANGO_MONITOR\t1'||lines.at(-1)?.join('\t')!=='END\t1')throw Error('error.incomplete');
    const data={processes:[]};const number=v=>{if(!/^\d+$/.test(v))throw Error('error.format');const n=Number(v);if(!Number.isSafeInteger(n))throw Error('error.format');return n;};
    const seen=new Set();
    for(const row of lines.slice(1,-1)){
      if(row[0]!=='PROCESS'){if(seen.has(row[0]))throw Error('error.format');seen.add(row[0]);}
      if(row[0]==='SERVICE'&&row.length===2)data.service=row[1];
      else if(row[0]==='ROOT'&&row.length===2)data.root=number(row[1]);
      else if(row[0]==='PROCESS'&&row.length===5){if(data.processes.length>=100)throw Error('error.format');data.processes.push({pid:number(row[1]),ppid:number(row[2]),rss:number(row[3]),name:row[4]});}
      else if(row[0]==='SUMMARY'&&row.length===4){data.found=number(row[1]);data.count=number(row[2]);data.rss=number(row[3]);}
      else throw Error('error.format');
    }
    if(!seen.has('ROOT')||!seen.has('SERVICE')||!seen.has('SUMMARY')||data.found>1||data.processes.length!==Math.min(data.count,100)||(!data.found&&data.count!==0))throw Error('error.incomplete');
    return data;
  }
  function poller({read,receive,fail,schedule=setTimeout,cancel=clearTimeout}){
    let active=false,busy=false,timer=null,epoch=0;
    function later(delay){if(active)timer=schedule(tick,delay);}
    async function tick(){
      timer=null;if(!active||busy)return;busy=true;const generation=epoch;let delay=5000;
      try{const value=await read();if(active&&generation===epoch)receive(value);}
      catch(e){delay=15000;if(active&&generation===epoch)fail(e);}
      finally{busy=false;later(delay);}
    }
    return {setActive(value){if(value===active)return;active=value;epoch++;if(timer!==null){cancel(timer);timer=null;}if(active&&!busy)tick();}};
  }
  function status(text){
    const rows=text.trim().split(/\r?\n/);
    if(rows.shift()!=='CONTROL\t1')throw Error('error.format');
    const data={};
    for(const key of ['ENABLED','NOW','SAMPLED','AVAILABLE']){
      const row=(rows.shift()||'').split('\t');
      if(row.length!==2||row[0]!==key||!/^\d+$/.test(row[1])||!Number.isSafeInteger(Number(row[1])))throw Error('error.format');
      data[key.toLowerCase()]=Number(row[1]);
    }
    if(data.enabled>1||data.available>1)throw Error('error.format');
    data.snapshot=data.available?parse(rows.join('\n')):null;
    if(!data.available&&rows.length)throw Error('error.format');
    data.fresh=data.available&&data.now>=data.sampled&&data.now-data.sampled<=30;
    return data;
  }
  root.TangoMonitor={parse,status,poller};
  if(typeof module!=='undefined')module.exports=root.TangoMonitor;
})(globalThis);
