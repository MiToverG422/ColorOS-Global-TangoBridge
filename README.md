# ColorOS Global TangoBridge

为指定国际版 ColorOS 恢复 ARM32 应用运行环境的实验性 KernelSU 模块。利用厂商 Tango 转译运行库、ARM32 framework 和本项目的启动器、兼容层，让原本仅提供 ARM64 应用环境的系统运行部分 32 位应用。

**适用系统版本：国际版 ColorOS `16.0.10.500(EX01)`。** **目前仅支持骁龙处理器，不支持联发科。** 具体兼容性以安装及运行检查为准，并非所有骁龙设备均可使用。

## 当前适配

| 项目 | 要求 / 来源 |
| --- | --- |
| 目标机型 | CPH2841 |
| 国际版系统 | `CPH2841_16.0.10.500(EX01)` |
| OTA 标识 | `CPH2841_11.A.63_0630_202607311128` |
| 国行运行库来源 | 同机型国行 PMA120，`16.0.10.501(CN01)` |
| 转译器 | 厂商 Tango 2.0.7 二进制 |
| 管理器 | KernelSU 兼容管理器，已取得 root |

本模块不刷写系统分区，通过挂载运行库并启动系统已有的 `zygote_tango` 服务提供 ARM32 环境。64 位启动器在独立挂载命名空间内为 ARM32 进程提供匹配的 Java 组件，兼容层处理文件描述符路径识别。正常使用保持 SELinux Enforcing。

## 在 GitHub 构建

1. 打开本仓库 **Actions → Build module → Run workflow**，选择 `main`。
2. 等待 `check` 和 `build` 均成功。
3. 在该次运行底部 **Artifacts** 下载 `ColorOS-Global-TangoBridge-cph2841-ex01-500`。
4. 解压下载的 Artifact，里面的 `ColorOS-Global-TangoBridge-*.zip` 才是可安装模块。不要把外层 Artifact ZIP 交给管理器安装。

输出同时包含 `SHA256SUMS` 和 `build-info.json`，记录源码提交、输入基底及产物哈希。Artifact 保留 30 天，过期后可重新运行构建。普通 push / PR 运行源码检查；完整模块构建由手动触发。

### 构建范围与二进制来源

工作流使用固定 Android NDK `29.0.14206865` 从源码编译 ARM64 启动器、zygote 探针和 ARM32 兼容库。然后下载本仓库 `runtime-cph2841-ex01-500-v1` Release 中的已固定运行库基底，验证 ZIP 和 `payload.img` 的 SHA-256，将新编译文件写入镜像并重新打包。

**这不是从源码编译 Tango。** Tango 和 Android / OPlus 配套运行库是固件预编译文件；完整固件不存入 Git。0.7.0 起，工作流还从源码编译手机端网络 Java 合并工具，运行合并回归测试，并打包哈希固定的国行网络 JAR。依赖的版本、下载地址和 SHA-256 在 `scripts/build_network_tool.py` 中固定，第三方许可随模块放在 `network-tools/`。

运行库的权利归其原权利人；本仓库不为第三方固件二进制授予额外许可。

### 本地构建

需要 Linux、Python 3.11+、JDK 17、Android SDK（platforms;android-36、build-tools;36.0.0）、指定版本 Android NDK、`e2fsprogs`、`mount` 及可免交互使用的 sudo：

```sh
export ANDROID_NDK_HOME=/path/to/android-ndk
export ANDROID_HOME=/path/to/android-sdk
python3 -m unittest discover -s tests -v
python3 scripts/build.py
```

产物位于 `dist/`。可用 `--seed /path/to/seed.zip` 指定同一哈希的本地基底。Windows 可运行 `--native-only` 验证原生组件编译；镜像组装需要 Linux。

## 安装与卸载

### WebUI

安装后，在支持 WebUI 的 KernelSU 兼容管理器中打开本模块的 **WebUI / 打开** 入口，即可查看中文检测面板。已移除 `action.sh`，仅保留 WebUI 交互入口。

底部导航提供 **概览、检测、监控、诊断、设置** 五页。概览仅展示主要信息，更多设备信息默认折叠；检测页只为异常项显示建议。切换页面保留检测结果，支持返回导航。

设置页提供 **跟随系统 / 简体中文 / English**，语言选择会保存在当前管理器中。每次打开默认非全屏，可在设置页临时开启全屏。支持边到边接口的管理器中，页面背景延伸至状态栏区域，并使用管理器提供的安全边距避开系统栏；不支持相关接口时保留管理器默认布局。

- 分别显示系统适配、32 位服务响应及 SELinux 状态。
- 检查完整系统版本、网络组件哈希、内核接口、本次开机的运行库挂载、binfmt 注册与 ARM32 ABI。
- 显示机型、Android 版本、处理器、内核和运行时间；异常项附有简短处理建议。
- 手动刷新、生成并复制诊断摘要、按需查看最近 120 行启动日志。支持深色模式和窄屏。

监控页提供持久化的**后台监控开关，默认关闭**。开启后关闭 WebUI 仍继续采样，重启后自动恢复；关闭开关后停止采样，正在进行的采样或等待最多约 18 秒退出。停用或卸载模块也会停止监控。

后台每轮最多执行一次 `ps`，Tango 服务停止或未提供有效 PID 时跳过进程扫描。读取其 zygote 进程树，显示服务状态、进程数和近似 RSS 合计。包含 zygote 与辅助进程，不等同于应用数量，也不判断卡顿或闪退原因；共享页可能重复计入 RSS。每轮完成后等待 10 秒，不持有唤醒锁，休眠期间不保证采样频率。仅覆盖一份最新快照，列表最多 100 项，不扫描 maps、不循环运行完整诊断、不记录历史日志。WebUI 只在监控页可见时每 5 秒读缓存；通过开机计时判断数据是否超过 30 秒，不受手动改时间或系统校时影响。采样日期仍使用系统时间显示。快速切回监控页时，旧请求结束后立即读取新状态，不额外等待一轮。

页面通过 [KernelSU WebUI 接口](https://kernelsu.org/zh_CN/guide/module-webui.html) 调用固定的检测命令，在 init 挂载命名空间读取状态。探针只查询 zygote ABI，不启动应用。所有页面资源随模块打包，无 CDN、联网请求或遥测，仅监控开关写入后台采样配置，不修改运行库属性或重启 Tango 服务。摘要不采集序列号和应用列表；日志可能包含应用路径，分享前请检查。

普通浏览器无法获取 root 检测数据，会明确显示无法连接管理器；读取失败或超时不会继续显示历史“正常”状态。模块状态文件仅作为诊断记录，绿色状态需要当前挂载及服务探测通过。停用或卸载尚未重启时会显示待生效提示。

### 管理模块

在受支持的设备上，通过 KernelSU 兼容管理器安装模块 ZIP，重启后打开模块 WebUI 查看状态。停用或卸载模块并重启可撤销运行时挂载。模块 ID 保持 `tango32_findx9u`，用于覆盖此前个人测试版。

OTA 后应先停用模块，确认新系统兼容性后再启用。适配其他机型或版本需要重新检查内核接口、init 服务、ART/APEX、运行库及应用实测，仅相同版本号不足以判断兼容。

清除系统数据后，Google Play 系统组件可能恢复为预置版本，即使 ColorOS 版本号不变，网络 APEX 也可能改变。

### 网络组件自动适配（0.7.0-test）

启动时读取当前 `/apex/com.android.tethering/javalib` 的 JAR，在手机本地生成 ARM32 专用副本。保留当前系统的非 HTTP 类，以随模块提供的国行 HTTP/Cronet Java 类匹配国行 ARM32 原生库，并补入缺失的国行类。仅挂载到 ARM32 私有路径，不修改原 APEX、系统分区或 APK，不需要联网下载。

缓存位于 `/data/adb/tango32_findx9u/network-cache`，键由当前全部网络 JAR、合并工具、国行 JAR 和生成脚本的哈希构成。首次或组件变化后生成；相同输入直接校验并复用，不在后台持续扫描。当前流程在模块启动时执行，APEX 更新激活后的下次开机会重新检查。

生成过程有互斥锁、超时、内存及输入大小限制，输入在生成期间改变则放弃本次结果，完整文件校验后才发布缓存。启动前另用独立 ARM32 进程检查 HTTP/Cronet 原生库加载和 JNI 注册，再检查 Zygote 响应；探针不发起网络请求。失败时停止模块运行时并记录日志，不绕过检查继续启动。

**这是针对当前运行库的自动合并，不保证任意未来 APEX 或所有 App 都兼容。** 新的 Java 接口、原生依赖或结构变化仍可能需要更新规则/运行库；ART、内核和系统版本的兼容要求不因此放宽。单 DEX 以外的网络框架暂不支持。服务探针通过也不能替代 App 的联网和 WebView 实测。

排查时查看数据目录中的 `network-prepare.log`、`network-probe.log` 和 `startup.log`；摘要中的 `network_candidate` 表示可用配置，`network_mode` 表示已选运行配置。启动探测失败会标记该缓存，避免每次开机重复尝试；修复原因后可由 root 执行 `sh /data/adb/modules/tango32_findx9u/network-prepare.sh retry`，然后重启。该命令只解除失败标记，不修复损坏缓存。最多保留 8 份缓存，达到上限或发现损坏时明确报错；为避免影响正在使用的私有挂载，不自动删除旧缓存。

## 目录

- `module/`：安装、启动、状态与撤销脚本。
- `src/`：本项目原生组件及网络 Java 合并工具源码。
- `profiles/`：固定设备适配信息、基底 URL 和哈希。
- `scripts/build.py`：校验、编译、镜像组装与打包。
- `tests/`：构建输入校验及 ZIP 格式检查。

反馈问题请提供机型、完整系统版本、模块版本、应用名称和必要的脱敏错误日志。

## 许可证

Copyright (C) 2026 MiToverG422。

本项目原创源码、脚本和文档采用 [GNU General Public License v3.0](LICENSE)（SPDX：`GPL-3.0-only`）发布，不提供任何担保。后续构建的模块 ZIP 会附带许可证全文。

该授权不覆盖 Tango、Android / OPlus 固件运行库及其衍生的第三方组件；它们仍受各自原有许可和权利约束，本项目不将这些组件重新授权为 GPL-3.0。
