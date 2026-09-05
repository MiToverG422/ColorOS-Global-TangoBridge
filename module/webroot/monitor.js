/* SPDX-License-Identifier: GPL-3.0-only */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id),t=TangoI18n.t;
  let state=null,error=false,changing=false,visible=true,sequence=0;
  const active=()=>visible&&!document.hidden&&location.hash==='#monitor'&&!changing;
  function command(action='status'){return new Promise((resolve,reject)=>{
    if(!['status','enable','disable'].includes(action)||typeof window.ksu?.exec!=='function'){reject(Error('error.bridge'));return;}
    const name=`tangoMonitor_${Date.now()}_${sequence++}`;
    const clean=()=>{clearTimeout(timer);delete window[name];};
    const timer=setTimeout(()=>{clean();reject(Error('error.timeout'));},12000);
    window[name]=(code,stdout)=>{clean();if(Number(code)!==0){reject(Error('error.read'));return;}try{resolve(TangoMonitor.status(String(stdout)));}catch(e){reject(e);}};
    try{window.ksu.exec(`sh /data/adb/modules/tango32_findx9u/monitor-control.sh ${action}`,'{}',name);}catch(e){clean();reject(e);}
  });}
  function render(){
    const snapshot=state?.enabled&&state.fresh?state.snapshot:null;
    if(!changing)$('monitor-toggle').checked=!!state?.enabled;
    $('monitor-toggle').disabled=changing||!state;
    $('monitor-status').textContent=t(error?'monitor.error':!state?'loading':!state.enabled?'monitor.off':state.fresh?'monitor.active':'monitor.stale');
    $('monitor-time').textContent=state?.sampled?t('updated',{time:new Date(state.sampled*1000).toLocaleTimeString(TangoI18n.language())}):'—';
    $('monitor-service').textContent=snapshot?t(snapshot.service==='running'?'running':snapshot.service==='stopped'?'monitor.stopped':'unknown'):'—';
    $('monitor-count').textContent=snapshot?String(snapshot.count):'—';
    $('monitor-memory').textContent=snapshot?`${(snapshot.rss/1024).toFixed(1)} MiB`:'—';
    $('monitor-processes').replaceChildren();
    if(snapshot?.found){
      snapshot.processes.forEach(p=>{
        const row=document.createElement('div');row.className='process-row';
        const name=document.createElement('span');name.textContent=p.name;name.className='process-name';
        const meta=document.createElement('small');meta.textContent=`PID ${p.pid} · ${(p.rss/1024).toFixed(1)} MiB`;
        row.append(name,meta);$('monitor-processes').append(row);
      });
    }else{const p=document.createElement('p');p.className='muted';p.textContent=t(snapshot?'monitor.noRoot':error?'monitor.error':'monitor.empty');$('monitor-processes').append(p);}
    $('monitor-limit').hidden=!snapshot||snapshot.count<=100;
  }
  const monitor=TangoMonitor.poller({read:()=>command(),receive(value){state=value;error=false;render();},fail(){state=null;error=true;render();}});
  function sync(){monitor.setActive(active());render();}
  $('monitor-toggle').addEventListener('change',async()=>{
    const action=$('monitor-toggle').checked?'enable':'disable';
    changing=true;sync();
    try{state=await command(action);error=false;}catch(_){state=null;error=true;}
    finally{changing=false;sync();}
  });
  window.addEventListener('hashchange',sync);
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('pagehide',()=>{visible=false;sync();});
  window.addEventListener('pageshow',()=>{visible=true;sync();});
  window.addEventListener('tango:language',render);
  sync();
})();
