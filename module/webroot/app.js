/* SPDX-License-Identifier: GPL-3.0-only */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), I = TangoI18n, t = I.t;
  const pages = ['overview','checks','monitor','diagnostics','settings'];
  const commands = Object.freeze({snapshot:'sh /data/adb/modules/tango32_findx9u/diagnose.sh',logs:'sh /data/adb/modules/tango32_findx9u/diagnostic-log.sh'});
  let snapshot = null, busy = false, failed = false, counter = 0, noticeKey = '', noticeValues = {};
  const bridgeAvailable = () => window.ksu && typeof window.ksu.exec === 'function';
  const element = (tag,text,cls) => {const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;};
  function notice(key='', values={}) {noticeKey=key;noticeValues=values;$('notice').textContent=t(key,values);$('notice').hidden=!key;}
  function showPage(focus=false) {
    const name = pages.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
    pages.forEach(p=>$(`page-${p}`).hidden=p!==name);
    document.querySelectorAll('[data-page]').forEach(a=>{if(a.dataset.page===name)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    $('hero-title').textContent=t(name);document.title=`TangoBridge · ${t(name)}`;
    document.querySelector('.toolbar').hidden=['settings','monitor'].includes(name);
    if(focus){scrollTo(0,0);$('hero-title').focus({preventScroll:true});}
  }
  const needsSnapshot=()=>!['settings','monitor'].includes(location.hash.slice(1));
  window.addEventListener('hashchange',()=>{showPage(true);if(needsSnapshot()&&!snapshot&&!failed)refresh();});
  function updateTheme() {
    document.querySelector('meta[name="theme-color"]').content=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',updateTheme);
  function fullscreen(enabled) {
    try {
      if(!window.ksu || typeof window.ksu.fullScreen!=='function')throw Error('unsupported');
      window.ksu.fullScreen(enabled);$('fullscreen').checked=enabled;
    } catch (_) {$('fullscreen').checked=false;$('fullscreen').disabled=true;}
    // fullScreen(false) resets native insets handling. Re-enable drawing behind
    // transparent system bars; KernelSU injects --safe-area-inset-* dynamically.
    try {
      if(typeof window.ksu?.enableEdgeToEdge==='function') {
        window.ksu.enableEdgeToEdge(true);
        document.documentElement.classList.add('edge-to-edge');
      }
    } catch (_) {document.documentElement.classList.remove('edge-to-edge');}
    $('fullscreen-hint').textContent=t($('fullscreen').disabled?'fullscreenUnavailable':'fullscreenHint');
    updateTheme();
  }
  $('fullscreen').addEventListener('change',()=>fullscreen($('fullscreen').checked));
  function execute(command) {
    return new Promise((resolve,reject)=>{
      if(!bridgeAvailable()){reject(Error('error.bridge'));return;}
      const name=`tangoResult_${Date.now()}_${counter++}`;
      const cleanup=()=>{clearTimeout(timer);delete window[name];};
      const timer=setTimeout(()=>{cleanup();reject(Error('error.timeout'));},20000);
      window[name]=(errno,stdout)=>{cleanup();if(Number(errno)!==0){const e=Error('error.read');e.code=errno;reject(e);}else resolve(String(stdout||''));};
      try{window.ksu.exec(command,'{}',name);}catch(_){cleanup();reject(Error('error.bridge'));}
    });
  }
  function rows(id,items){$(id).replaceChildren(...items.flatMap(([key,value])=>[element('dt',t(key)),element('dd',value||t('unknown'))]));}
  function report() {
    if(!snapshot)return;
    const h=TangoHealth.analyze(snapshot);
    $('report-text').value=['TangoBridge · '+t('reportTitle'),...Object.entries(snapshot).map(([k,v])=>`${k}: ${v}`),'',...h.checks.map(c=>`${t(c.ok?'pass':'issue')} · ${t(c.label)}${c.ok?'':': '+t(c.detail)}`)].join('\n');
  }
  function render() {
    if(!snapshot)return;
    const d=snapshot,h=TangoHealth.analyze(d);
    $('overview').className=`overview ${h.tone}`;$('status-mark').textContent=h.tone==='ok'?'✓':'!';
    $('status-title').textContent=t(h.title);$('status-description').textContent=t(h.description);
    $('compat').textContent=t(h.compatible?'supported':'unsupported');$('runtime').textContent=t(h.live?'running':'notReady');$('selinux').textContent=d.selinux||t('unknown');
    $('version').textContent=d.module_version||'—';$('updated').textContent=t('updated',{time:d.collected_at||'—'});
    const sec=Number(d.uptime);
    rows('device',[['model',d.model],['build',d.build],['soc',d.soc]]);
    const restarted=d.network_schema==='2'&&d.network_service_match==='0'&&d.network_stage==='ready';
    const networkStage=restarted?'failed':d.network_stage||'unknown';
    const networkReason=restarted?'service_restarted':d.network_reason||'none';
    $('network-stage').textContent=t(`network.stage.${networkStage}`);
    $('network-stage').className=`badge ${networkStage==='failed'?'warn':''}`;
    $('network-reason').hidden=networkReason==='none';
    $('network-reason').textContent=t(`network.reason.${networkReason}`);
    rows('network-details',[
      ['network.cache',`${d.network_cache_count||'0'} / 8`],
      ['network.duration',`${d.network_seconds||'0'} s`],
      ['network.selected',d.network_active_key?.slice(0,12)||'—']
    ]);
    rows('device-extra',[['Android',`${d.android||'—'} · API ${d.sdk||'—'}`],['uptime',Number.isFinite(sec)?t('duration',{h:Math.floor(sec/3600),m:Math.floor(sec%3600/60)}):'—'],['abi',d.abi32||t('notDeclared')],['kernel',d.kernel]]);
    $('check-count').textContent=t('count',{pass:h.checks.filter(c=>c.ok).length,total:h.checks.length});
    const checkRow=c=>{
      const row=element('div','',`check ${c.tone}`),content=element('div','');content.append(element('strong',t(c.label)));
      if(!c.ok)content.append(element('p',t(c.detail)));
      row.append(element('span',c.ok?'✓':'!','icon'),content,element('span',t(c.ok?'pass':'issue'),'result'));return row;
    };
    const passed=h.checks.filter(c=>c.ok),issues=h.checks.filter(c=>!c.ok);
    $('checks').replaceChildren(...(issues.length?issues.map(checkRow):[element('p',t('checks.allPassed'),'all-passed')]));
    $('passed-box').hidden=passed.length===0;
    $('passed-title').textContent=t('checks.passed',{count:passed.length});
    $('passed-checks').replaceChildren(...passed.map(checkRow));
    $('report').disabled=busy;
    if(!$('report-box').hidden)report();
  }
  function renderFailure() {
    $('overview').className='overview warn';$('status-mark').textContent='!';$('status-title').textContent=t('state.error');$('status-description').textContent=t('hint.error');
    ['compat','runtime','selinux'].forEach(id=>$(id).textContent=t('unknown'));
    $('updated').textContent='—';$('check-count').textContent='—';$('checks').replaceChildren(element('p',t('waiting'),'placeholder'));
    $('device').replaceChildren();$('device-extra').replaceChildren();$('network-details').replaceChildren();$('version').textContent='—';$('report').disabled=true;
    $('network-stage').textContent='—';$('network-reason').hidden=true;$('passed-box').hidden=true;$('passed-checks').replaceChildren();
  }
  function translate() {
    document.documentElement.lang=I.language();
    document.querySelectorAll('[data-i18n]').forEach(e=>e.textContent=t(e.dataset.i18n));
    $('language').value=I.preference;$('refresh').textContent=t(busy?'loading':'refresh');
    $('fullscreen-hint').textContent=t($('fullscreen').disabled?'fullscreenUnavailable':'fullscreenHint');
    showPage();if(snapshot)render();else if(failed)renderFailure();notice(noticeKey,noticeValues);
    window.dispatchEvent(new Event('tango:language'));
  }
  $('language').addEventListener('change',()=>{I.set($('language').value);translate();});
  window.addEventListener('languagechange',()=>{if(I.preference==='auto')translate();});
  async function refresh() {
    if(busy)return;busy=true;$('refresh').disabled=true;$('refresh').textContent=t('loading');$('report').disabled=true;
    $('report-box').hidden=true;$('log-box').hidden=true;notice();
    try{snapshot=TangoHealth.parseSnapshot(await execute(commands.snapshot));failed=false;render();}
    catch(e){snapshot=null;failed=true;renderFailure();notice(I.messages.en[e.message]?e.message:'error.unknown',{code:e.code??'?'});}
    finally{busy=false;$('refresh').disabled=false;$('refresh').textContent=t('refresh');$('report').disabled=!snapshot;$('logs').disabled=!bridgeAvailable();}
  }
  $('refresh').addEventListener('click',refresh);
  $('report').addEventListener('click',()=>{if(snapshot){report();$('report-box').hidden=false;}});
  $('copy').addEventListener('click',async()=>{
    const field=$('report-text');field.focus();field.select();
    try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(field.value);else if(!document.execCommand('copy'))throw Error();notice('copied');}catch(_){notice('copyManual');}
  });
  $('logs').addEventListener('click',async()=>{
    $('logs').disabled=true;$('log-kind').disabled=true;notice();
    try{const kind=$('log-kind').value;if(!['startup','prepare','probe'].includes(kind))throw Error('error.format');$('log-text').textContent=await execute(`${commands.logs} ${kind}`)||t('emptyLog');$('log-box').hidden=false;$('log-box').open=true;}
    catch(e){$('log-box').hidden=true;notice(I.messages.en[e.message]?e.message:'error.unknown',{code:e.code??'?'});}
    finally{$('logs').disabled=false;$('log-kind').disabled=false;}
  });
  $('log-kind').addEventListener('change',()=>{$('log-box').hidden=true;});
  translate();fullscreen(false);$('logs').disabled=!bridgeAvailable();if(needsSnapshot())refresh();
})();
