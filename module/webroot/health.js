/* SPDX-License-Identifier: GPL-3.0-only */
(function (root) {
  'use strict';
  function parseSnapshot(text) {
    const data = Object.create(null);
    for (const line of text.trim().split('\n')) {
      const parts = line.split('\t');
      if (parts.length !== 2 || !/^[a-z_0-9]+$/.test(parts[0]) || Object.hasOwn(data, parts[0])) throw new Error('error.format');
      data[parts[0]] = new TextDecoder('utf-8', {fatal: true}).decode(Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0)));
    }
    const required = ['model', 'build', 'ota', 'build_match', 'apex_match', 'service', 'probe_code', 'image_mounted', 'system_overlay', 'binfmt', 'translator', 'current_boot', 'abi32', 'disabled', 'removal', 'kernel_interface', 'selinux', 'boot_complete'];
    if (data.schema !== '1' || data.complete !== '1' || required.some(k => !Object.hasOwn(data, k))) throw new Error('error.incomplete');
    return data;
  }
  function analyze(d) {
    const yes = key => d[key] === '1';
    const compatible = yes('build_match') && yes('apex_match');
    const abi = (d.abi32 || '').split(',').includes('armeabi-v7a');
    const live = d.service === 'running' && d.probe_code === '0';
    const mounts = yes('image_mounted') && yes('system_overlay') && yes('current_boot');
    const engine = yes('binfmt') && yes('translator');
    const pending = yes('disabled') || yes('removal');
    const ready = compatible && live && mounts && engine && abi && !pending && yes('boot_complete');
    const checks = [
      ['system', yes('build_match')], ['apex', yes('apex_match')],
      ['kernel', yes('kernel_interface')], ['mounts', mounts],
      ['engine', engine], ['service', live], ['abi', abi],
      ['selinux', d.selinux === 'Enforcing']
    ].map(([key, ok]) => ({label: `check.${key}`, ok, detail: `fix.${key}`, tone: ok ? 'ok' : 'warn'}));
    let title = 'state.waiting', description = 'hint.waiting', tone = 'warn';
    if (ready) { title = 'state.ready'; description = 'hint.ready'; tone = 'ok'; }
    if (ready && d.selinux !== 'Enforcing') { title = 'state.security'; description = 'fix.selinux'; tone = 'warn'; }
    if (!yes('boot_complete')) { title = 'state.booting'; description = 'hint.booting'; }
    if (!compatible) { title = 'state.unsupported'; description = 'hint.unsupported'; tone = 'bad'; }
    if (pending) { title = yes('removal') ? 'state.removal' : 'state.disabled'; description = 'hint.reboot'; tone = 'warn'; }

    return {compatible, live, ready, title, description, tone, checks};
  }
  root.TangoHealth = {parseSnapshot, analyze};
  if (typeof module !== 'undefined') module.exports = root.TangoHealth;
})(globalThis);
