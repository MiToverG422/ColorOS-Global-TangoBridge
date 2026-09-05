/* SPDX-License-Identifier: GPL-3.0-only */
(function(root) {
  const messages = {
    'zh-CN': {
      "monitor":"监控",
      "snapdragon":"目前仅支持骁龙处理器",
      "monitor.background":"后台监控",
      "monitor.hint":"默认关闭 · 开启后重启恢复",
      "monitor.off":"已关闭",
      "monitor.active":"后台监控中",
      "monitor.stale":"等待最新采样",
      "monitor.error":"无法读取监控状态",
      "monitor.stopped":"已停止",
      "monitor.count":"进程数",
      "monitor.memory":"RSS 合计",
      "monitor.tree":"Tango 进程树",
      "monitor.scope":"包含 zygote 及子进程；RSS 含共享内存重复计数。",
      "monitor.limit":"仅展示前 100 项，合计包含全部进程。",
      "monitor.cost":"每 10 秒采样 · 仅保存最新结果 · 不阻止休眠",
      "monitor.empty":"暂无当前数据",
      "monitor.noRoot":"未发现 Tango 进程",
      overview:'概览',checks:'检测',diagnostics:'诊断',settings:'设置',refresh:'刷新',loading:'检测中…',
      waiting:'尚未检测',updated:'更新于 {time}',device:'设备',version:'版本',compat:'系统适配',runtime:'32 位服务',
      supported:'匹配',unsupported:'不匹配',running:'正常',notReady:'未就绪',unknown:'未知',pass:'通过',issue:'异常',
      count:'{pass} / {total} 通过',model:'机型',build:'系统',soc:'处理器',uptime:'运行时间',abi:'32 位 ABI',kernel:'内核',
      duration:'{h} 小时 {m} 分',notDeclared:'未声明',report:'生成摘要',copy:'复制',logs:'启动日志',
      reportTitle:'诊断摘要',logTitle:'最近 120 行',emptyLog:'暂无日志',privacy:'分享日志前，请检查应用路径等信息。',
      language:'语言',auto:'跟随系统',fullscreen:'全屏显示',fullscreenHint:'默认关闭',fullscreenUnavailable:'管理器不支持全屏',
      applicable:'适用版本',details:'更多信息',checkHint:'仅异常项显示处理建议',copied:'已复制',copyManual:'已选中，请长按复制',
      'state.waiting':'尚未就绪','hint.waiting':'请查看检测页。','state.ready':'运行正常','hint.ready':'32 位服务已就绪。',
      'state.security':'请检查 SELinux','state.booting':'正在启动','hint.booting':'稍后刷新。',
      'state.unsupported':'适配不匹配','hint.unsupported':'请查看异常项。','state.removal':'等待卸载','state.disabled':'已停用','hint.reboot':'重启后生效。',
      'check.system':'系统版本','check.apex':'网络组件','check.kernel':'内核接口','check.mounts':'运行库挂载',
      'check.engine':'转译引擎','check.service':'32 位服务','check.abi':'安装接口','check.selinux':'SELinux',
      'fix.system':'核对设备配置与 16.0.10.500(EX01) 版本。','fix.apex':'组件校验不匹配，需要重新适配。',
      'fix.kernel':'缺少 /dev/tango32。','fix.mounts':'挂载未就绪，重启后仍异常请查看日志。',
      'fix.engine':'转译器或 binfmt 不可用，请查看日志。','fix.service':'服务未响应，请查看启动日志。',
      'fix.abi':'系统未声明 ARM32 支持。','fix.selinux':'应为 Enforcing，请检查系统设置。',
      'error.bridge':'请从管理器打开 WebUI。','error.timeout':'读取超时，请重试。','error.read':'读取失败（{code}）',
      'error.format':'检测数据格式异常。','error.incomplete':'检测未完成，请刷新。','error.unknown':'读取失败，请重试。',
      'state.error':'无法读取','hint.error':'请检查管理器权限后刷新。'
    },
    en: {
      "monitor":"Monitor",
      "snapdragon":"Currently supports Snapdragon only",
      "monitor.background":"Background monitoring",
      "monitor.hint":"Off by default · Restores on reboot when enabled",
      "monitor.off":"Off",
      "monitor.active":"Monitoring in background",
      "monitor.stale":"Waiting for a fresh sample",
      "monitor.error":"Unable to read monitor status",
      "monitor.stopped":"Stopped",
      "monitor.count":"Processes",
      "monitor.memory":"Total RSS",
      "monitor.tree":"Tango process tree",
      "monitor.scope":"Includes zygote and descendants. RSS counts shared memory more than once.",
      "monitor.limit":"Showing the first 100 entries; totals include all processes.",
      "monitor.cost":"10-second sampling · Latest result only · No wake lock",
      "monitor.empty":"No current data",
      "monitor.noRoot":"No Tango process found",
      overview:'Overview',checks:'Checks',diagnostics:'Diagnostics',settings:'Settings',refresh:'Refresh',loading:'Checking…',
      waiting:'Not checked',updated:'Updated {time}',device:'Device',version:'Version',compat:'Compatibility',runtime:'32-bit service',
      supported:'Matched',unsupported:'Mismatch',running:'Running',notReady:'Not ready',unknown:'Unknown',pass:'Passed',issue:'Issue',
      count:'{pass} / {total} passed',model:'Model',build:'System',soc:'Processor',uptime:'Uptime',abi:'32-bit ABI',kernel:'Kernel',
      duration:'{h}h {m}m',notDeclared:'Not declared',report:'Create report',copy:'Copy',logs:'Startup log',
      reportTitle:'Diagnostic report',logTitle:'Last 120 lines',emptyLog:'No log entries',privacy:'Check logs for app paths before sharing.',
      language:'Language',auto:'System default',fullscreen:'Fullscreen',fullscreenHint:'Off by default',fullscreenUnavailable:'Not supported by this manager',
      applicable:'System version',details:'More details',checkHint:'Suggestions appear only for failed checks',copied:'Copied',copyManual:'Text selected. Long-press to copy.',
      'state.waiting':'Not ready','hint.waiting':'See the Checks page.','state.ready':'Running normally','hint.ready':'32-bit service is ready.',
      'state.security':'Check SELinux','state.booting':'Starting up','hint.booting':'Refresh shortly.',
      'state.unsupported':'Compatibility mismatch','hint.unsupported':'Review the failed checks.','state.removal':'Removal pending','state.disabled':'Disabled','hint.reboot':'Takes effect after reboot.',
      'check.system':'System version','check.apex':'Network component','check.kernel':'Kernel interface','check.mounts':'Runtime mounts',
      'check.engine':'Translator','check.service':'32-bit service','check.abi':'Install interface','check.selinux':'SELinux',
      'fix.system':'Check the device profile and 16.0.10.500(EX01) build.','fix.apex':'Component checksum mismatch; adaptation is required.',
      'fix.kernel':'Missing /dev/tango32.','fix.mounts':'Mounts are not ready. Reboot, then check logs if needed.',
      'fix.engine':'Translator or binfmt unavailable. Check logs.','fix.service':'Service did not respond. Check the startup log.',
      'fix.abi':'ARM32 support is not declared.','fix.selinux':'Expected Enforcing. Check system settings.',
      'error.bridge':'Open this WebUI from your manager.','error.timeout':'Read timed out. Try again.','error.read':'Read failed ({code})',
      'error.format':'Invalid diagnostic data.','error.incomplete':'Incomplete data. Refresh to retry.','error.unknown':'Read failed. Try again.',
      'state.error':'Unable to read','hint.error':'Check manager permissions, then refresh.'
    }
  };
  let preference = 'auto';
  try { preference = localStorage.getItem('tango.language') || 'auto'; } catch (_) {}
  if (!['auto','zh-CN','en'].includes(preference)) preference = 'auto';
  function language() { return preference === 'auto' ? ((root.navigator?.language || 'en').startsWith('zh') ? 'zh-CN' : 'en') : preference; }
  function t(key, values = {}) { return (messages[language()][key] || messages.en[key] || key).replace(/\{(\w+)\}/g, (m,k) => values[k] ?? m); }
  function set(value) { preference = ['auto','zh-CN','en'].includes(value) ? value : 'auto'; try { localStorage.setItem('tango.language',preference); } catch (_) {} }
  root.TangoI18n = {t,set,language,get preference(){return preference;},messages};
  if (typeof module !== 'undefined') module.exports = root.TangoI18n;
})(globalThis);
