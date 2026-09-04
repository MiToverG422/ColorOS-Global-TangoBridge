/* SPDX-License-Identifier: GPL-3.0-only */
(function (root) {
  'use strict';
  function parseSnapshot(text) {
    const data = Object.create(null);
    for (const line of text.trim().split('\n')) {
      const parts = line.split('\t');
      if (parts.length !== 2 || !/^[a-z_0-9]+$/.test(parts[0]) || Object.hasOwn(data, parts[0])) throw new Error('检测数据格式异常');
      data[parts[0]] = new TextDecoder('utf-8', {fatal: true}).decode(Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0)));
    }
    const required = ['model', 'build', 'ota', 'build_match', 'apex_match', 'service', 'probe_code', 'image_mounted', 'system_overlay', 'binfmt', 'translator', 'current_boot', 'abi32', 'disabled', 'removal', 'kernel_interface', 'selinux', 'boot_complete'];
    if (data.schema !== '1' || data.complete !== '1' || required.some(k => !Object.hasOwn(data, k))) throw new Error('检测未完成，请重新刷新');
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
      ['系统版本', yes('build_match'), '机型、完整版本与内核接口符合当前适配。', '仅支持 CPH2841 EX01 16.0.10.500。请核对完整版本和内核支持，不要绕过安装检查。'],
      ['网络组件', yes('apex_match'), '网络 framework 校验与适配版本一致。', '网络组件与预期不一致，可能已被 OTA 或系统组件更新替换，需要重新适配。'],
      ['内核转译接口', yes('kernel_interface'), '检测到 Tango 内核接口。', '未检测到 /dev/tango32，当前内核无法提供所需接口。'],
      ['运行库挂载', mounts, '本次开机的镜像与系统库覆盖挂载已就绪。', '本次开机的挂载未完整就绪。安装后请重启；仍异常时查看启动日志。'],
      ['转译引擎', engine, 'Tango 程序和 binfmt 注册均可用。', '转译程序缺失或 binfmt 未启用，请查看启动日志中的挂载、注册错误。'],
      ['32 位服务响应', live, 'zygote_tango 正在运行，且 ARM32 ABI 查询成功。', '服务未运行或没有正确响应。建议先查看启动日志，再通过管理器重启手机。'],
      ['应用安装接口', abi, '系统已声明 armeabi-v7a 支持。', '系统尚未声明 ARM32 ABI。只修改安装属性不能证明转译环境正常。'],
      ['SELinux', d.selinux === 'Enforcing', '强制模式已启用。', '当前不是 Enforcing 或无法读取；本模块正常运行不需要关闭 SELinux。'],
    ].map(([label, ok, pass, fail]) => ({label, ok, detail: ok ? pass : fail, tone: ok ? 'ok' : 'warn'}));
    let title = '运行环境待就绪', description = '部分运行检查尚未通过，请查看下方原因。', tone = 'warn';
    if (ready) { title = '32 位运行环境已就绪'; description = '系统适配、运行库和服务响应均通过检测，可以尝试打开 32 位应用。'; tone = 'ok'; }
    if (ready && d.selinux !== 'Enforcing') { title = '运行已就绪，安全状态需检查'; description = '转译环境检查通过，但 SELinux 状态异常，请查看下方检查。'; tone = 'warn'; }
    if (!yes('boot_complete')) { title = '系统正在启动'; description = '请等待系统完成开机后刷新检测。'; }
    if (!compatible) { title = '当前系统不符合适配条件'; description = '当前模块的适配范围或组件校验不匹配，请查看下方检查结果。'; tone = 'bad'; }
    if (pending) { title = yes('removal') ? '模块等待卸载' : '模块已停用'; description = '重启后变更生效。当前进程和挂载可能仍在运行。'; tone = 'warn'; }
    return {compatible, live, ready, title, description, tone, checks};
  }
  root.TangoHealth = {parseSnapshot, analyze};
  if (typeof module !== 'undefined') module.exports = root.TangoHealth;
})(globalThis);
