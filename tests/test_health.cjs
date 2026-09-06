// SPDX-License-Identifier: GPL-3.0-only
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {analyze, parseSnapshot} = require('../module/webroot/health.js');
const ready = {schema:'1', complete:'1', model:'CPH2841', build:'EX01', ota:'500',
  build_match:'1', apex_match:'1', service:'running', probe_code:'0',
  image_mounted:'1', system_overlay:'1', binfmt:'1', translator:'1',
  current_boot:'1', abi32:'armeabi-v7a,armeabi', disabled:'0', removal:'0',
  kernel_interface:'1', selinux:'Enforcing', boot_complete:'1'};
const encode = d => Object.entries(d).map(([k,v]) => `${k}\t${Buffer.from(v).toString('base64')}`).join('\n');
test('dynamic readiness requires verified cache, active input match and JNI evidence',()=>{
  const dynamic={...ready,network_schema:'1',network_cache_valid:'1',network_active_match:'1',network_jni:'1',network_mode:'dynamic',network_stage:'ready',network_reason:'none'};
  assert.equal(analyze(dynamic).ready,true);
  for(const key of ['network_cache_valid','network_active_match','network_jni'])assert.equal(analyze({...dynamic,[key]:'0'}).ready,false);
  assert.equal(analyze({...dynamic,network_mode:'factory'}).ready,false);
  delete dynamic.network_jni;
  assert.throws(()=>parseSnapshot(encode(dynamic)));
});
test('ready requires current evidence, not an old status file', () => {
  assert.equal(analyze(ready).ready, true);
  for (const [key,value] of [['probe_code','1'], ['current_boot','0'], ['image_mounted','0'], ['system_overlay','0'], ['binfmt','0'], ['abi32',''], ['service','stopped'], ['apex_match','0'], ['boot_complete','0']]) {
    assert.equal(analyze({...ready, status:'READY', [key]:value}).ready, false, key);
  }
});
test('disabled and removed modules show pending reboot instead of green', () => {
  assert.equal(analyze({...ready, disabled:'1'}).title, 'state.disabled');
  assert.equal(analyze({...ready, removal:'1'}).ready, false);
  assert.equal(analyze({...ready, selinux:'Permissive'}).tone, 'warn');
});
test('snapshot transport preserves untrusted Unicode text and rejects truncation', () => {
  const value = '中文\n<script>alert(1)</script>\t"\\';
  assert.equal(parseSnapshot(encode({...ready, model:value})).model, value);
  assert.throws(() => parseSnapshot(encode({...ready, complete:'0'})));
  assert.throws(() => parseSnapshot(encode(ready) + '\nmodel\tWA=='));
  assert.throws(() => parseSnapshot(encode(ready).replace('model\t', 'invalid-key\t')));
  const missing = {...ready}; delete missing.probe_code;
  assert.throws(() => parseSnapshot(encode(missing)));
});

test('restarted zygote cannot inherit successful startup evidence',()=>{
 const d={...ready,network_schema:'2',network_cache_valid:'1',network_active_match:'1',network_jni:'1',network_mode:'dynamic',network_service_match:'0'};
 assert.equal(analyze(d).ready,false);
 assert.equal(analyze({...d,network_service_match:'1'}).ready,true);
});
