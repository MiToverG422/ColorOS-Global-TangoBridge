/* SPDX-License-Identifier: GPL-3.0-only */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const pages = {
    overview: ['OVERVIEW / 01', '运行概览', '系统信息与转译状态，一眼掌握。'],
    checks: ['HEALTH / 02', '兼容性检测', '逐项检查运行环境，了解异常原因。'],
    diagnostics: ['DIAGNOSTICS / 03', '诊断工具', '整理检测摘要，按需查看启动日志。']
  };
  function showPage(moveFocus = false) {
    const requested = location.hash.slice(1);
    const page = Object.hasOwn(pages, requested) ? requested : 'overview';
    for (const name of Object.keys(pages)) $(`page-${name}`).hidden = name !== page;
    document.querySelectorAll('[data-page]').forEach(link => {
      if (link.dataset.page === page) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    [$('page-label').textContent, $('hero-title').textContent, $('page-description').textContent] = pages[page];
    document.title = `TangoBridge · ${pages[page][1]}`;
    if (moveFocus) { window.scrollTo(0, 0); $('hero-title').focus({preventScroll: true}); }
  }
  window.addEventListener('hashchange', () => showPage(true));
  showPage();

  let fullscreenRequested = false;
  function setFullscreen(enabled) {
    const button = $('fullscreen');
    try {
      if (!window.ksu || typeof window.ksu.fullScreen !== 'function') throw new Error('unsupported');
      window.ksu.fullScreen(enabled);
      fullscreenRequested = enabled;
      button.textContent = enabled ? '退出全屏' : '进入全屏';
      button.setAttribute('aria-pressed', String(enabled));
    } catch (_) {
      button.textContent = '全屏不可用';
      button.title = '当前管理器未提供可用的全屏接口';
      button.disabled = true;
      button.setAttribute('aria-pressed', 'false');
    }
  }
  $('fullscreen').addEventListener('click', () => setFullscreen(!fullscreenRequested));
  setFullscreen(true);
  const COMMANDS = Object.freeze({
    snapshot: 'sh /data/adb/modules/tango32_findx9u/diagnose.sh',
    logs: '/data/adb/ksu/bin/busybox timeout 5 /data/adb/ksu/bin/busybox tail -n 120 /data/adb/tango32_findx9u/startup.log'
  });
  let counter = 0, snapshot = null, busy = false;
  const bridgeAvailable = () => window.ksu && typeof window.ksu.exec === 'function';
  function execute(command) {
    return new Promise((resolve, reject) => {
      if (!bridgeAvailable()) { reject(new Error('请从 KernelSU 兼容管理器打开模块 WebUI。普通浏览器无法读取手机状态。')); return; }
      const name = `tangoResult_${Date.now()}_${counter++}`;
      const cleanup = () => { clearTimeout(timer); delete window[name]; };
      const timer = setTimeout(() => { cleanup(); reject(new Error('读取超时，请稍后刷新并检查管理器的 root 授权。')); }, 20000);
      window[name] = (errno, stdout, stderr) => {
        cleanup();
        if (Number(errno) !== 0) reject(new Error(`读取失败（${errno}）。${String(stderr || '').slice(0, 500) || '请检查模块安装与 root 授权。'}`));
        else resolve(String(stdout || ''));
      };
      try { window.ksu.exec(command, '{}', name); } catch (e) { cleanup(); reject(e); }
    });
  }
  function notice(message) { $('notice').textContent = message; $('notice').hidden = !message; }
  function element(tag, text, className) { const el = document.createElement(tag); el.textContent = text; if (className) el.className = className; return el; }
  function render(d) {
    const h = TangoHealth.analyze(d);
    $('overview').className = `overview ${h.tone}`;
    $('status-mark').textContent = h.tone === 'ok' ? '✓' : '!';
    $('status-title').textContent = h.title;
    $('status-description').textContent = h.description;
    $('compat').textContent = h.compatible ? '符合适配' : '不匹配';
    $('runtime').textContent = h.live ? '响应正常' : '未就绪';
    $('selinux').textContent = d.selinux || '无法读取';
    $('version').textContent = d.module_version || '未知版本';
    $('updated').textContent = `更新于 ${d.collected_at || '刚刚'}`;
    const seconds = Number(d.uptime);
    const uptime = Number.isFinite(seconds) ? `${Math.floor(seconds / 3600)} 小时 ${Math.floor(seconds % 3600 / 60)} 分钟` : '未知';
    const rows = [['机型', d.model], ['系统版本', d.build], ['Android', `${d.android || '—'} · API ${d.sdk || '—'}`], ['处理器', d.soc], ['运行时间', uptime], ['32 位 ABI', d.abi32 || '未声明'], ['内核', d.kernel]];
    $('device').replaceChildren(...rows.flatMap(([key, value]) => [element('dt', key), element('dd', value || '未提供')]));
    $('check-count').textContent = `${h.checks.filter(c => c.ok).length} / ${h.checks.length} 通过`;
    $('checks').replaceChildren(...h.checks.map(c => {
      const row = element('div', '', `check ${c.tone}`), content = element('div', '');
      content.append(element('strong', c.label), element('p', c.detail));
      row.append(element('span', c.ok ? '✓' : '!', 'icon'), content, element('span', c.ok ? '通过' : '待检查', 'result'));
      return row;
    }));
    $('report').disabled = false;
  }
  function resetOnFailure() {
    snapshot = null;
    $('overview').className = 'overview warn';
    $('status-mark').textContent = '!';
    $('status-title').textContent = '无法确认当前状态';
    $('status-description').textContent = '本次未获取到完整检测结果，请处理提示后重新刷新。';
    for (const id of ['compat', 'runtime', 'selinux']) $(id).textContent = '未知';
    $('updated').textContent = '本次检测未完成';
    $('check-count').textContent = '等待重新检测';
    $('checks').replaceChildren(element('p', '未显示历史检查结果，避免误判为当前状态。', 'placeholder'));
    $('device').replaceChildren(element('dt', '设备数据'), element('dd', '暂不可用'));
    $('version').textContent = '版本待检测';
    $('report').disabled = true;
  }
  async function refresh() {
    if (busy) return;
    busy = true; $('refresh').disabled = true; $('refresh').textContent = '检测中…'; $('report').disabled = true;
    $('report-box').hidden = true; $('log-box').hidden = true; notice('');
    try { snapshot = TangoHealth.parseSnapshot(await execute(COMMANDS.snapshot)); render(snapshot); }
    catch (e) { resetOnFailure(); notice(e.message || String(e)); }
    finally { busy = false; $('refresh').disabled = false; $('refresh').textContent = '刷新检测'; $('logs').disabled = !bridgeAvailable(); }
  }
  $('refresh').addEventListener('click', refresh);
  $('report').addEventListener('click', () => {
    if (!snapshot) return;
    const h = TangoHealth.analyze(snapshot);
    $('report-text').value = ['ColorOS Global TangoBridge 诊断摘要', ...Object.entries(snapshot).map(([k,v]) => `${k}: ${v}`), '', ...h.checks.map(c => `${c.ok ? '通过' : '待检查'} · ${c.label}: ${c.detail}`)].join('\n');
    $('report-box').hidden = false;
  });
  $('copy').addEventListener('click', async () => {
    const field = $('report-text'); field.focus(); field.select();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(field.value);
      else if (!document.execCommand('copy')) throw new Error('copy');
      notice('诊断摘要已复制。');
    } catch (_) { notice('无法自动复制，已选中摘要，请长按文本复制。'); }
  });
  $('logs').addEventListener('click', async () => {
    $('logs').disabled = true; notice('');
    try { $('log-text').textContent = (await execute(COMMANDS.logs)) || '日志为空。'; $('log-box').hidden = false; $('log-box').open = true; }
    catch (e) { $('log-box').hidden = true; notice(`暂时无法读取日志：${e.message}`); }
    finally { $('logs').disabled = false; }
  });
  refresh();
})();
