const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const I=require('../module/webroot/i18n.js');
test('translations have matching keys and cover the UI',()=>{
 assert.deepEqual(Object.keys(I.messages.en).sort(),Object.keys(I.messages['zh-CN']).sort());
 const html=fs.readFileSync('module/webroot/index.html','utf8');
 for(const [,key] of html.matchAll(/data-i18n="([^"]+)"/g)) assert.ok(I.messages.en[key],key);
 for(const locale of ['en','zh-CN']){
  I.set(locale);assert.equal(I.language(),locale);
  assert.ok(!I.t('count',{pass:8,total:8}).includes('{'));
  assert.notEqual(I.t('state.disabled'),'state.disabled');
 }
 I.set('invalid');assert.equal(I.preference,'auto');
});
