# ColorOS Global TangoBridge

为指定国际版 ColorOS 恢复 ARM32 应用运行环境的实验性 KernelSU 模块。利用厂商 Tango 转译运行库、ARM32 framework 和本项目的启动器、兼容层，让原本仅提供 ARM64 应用环境的系统运行部分 32 位应用。

**当前仅支持 OPPO Find X9 Ultra / CPH2841，国际版 `16.0.10.500(EX01)`。不代表所有 ColorOS 16、其他型号或后续 OTA 均兼容。** 安装脚本还会检查系统组件哈希与内核接口；请勿通过删除检查强行安装。

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

**这不是从源码编译 Tango。** Tango 和 Android / OPlus 配套运行库是固件预编译文件；完整固件不存入 Git。基底还包含已合并的网络 Java 组件：保留国际版接口，并匹配国行 ARM32 HTTP/Cronet 实现。`src/MergeConnectivity.java` 提供合并工具源码供审查，常规工作流直接使用基底内固定的合并结果，不重新生成该组件。

运行库的权利归其原权利人；本仓库不为第三方固件二进制授予额外许可。

### 本地构建

需要 Linux、Python 3.11+、指定版本 Android NDK、`e2fsprogs`、`mount` 及可免交互使用的 sudo：

```sh
export ANDROID_NDK_HOME=/path/to/android-ndk
python3 -m unittest discover -s tests -v
python3 scripts/build.py
```

产物位于 `dist/`。可用 `--seed /path/to/seed.zip` 指定同一哈希的本地基底。Windows 可运行 `--native-only` 验证原生组件编译；镜像组装需要 Linux。

## 安装与卸载

### 中文 WebUI（0.3.0-test）

安装后，在支持 WebUI 的 KernelSU 兼容管理器中打开本模块的 **WebUI / 打开** 入口，即可查看中文检测面板。Action 按钮仍提供简短的文本状态。

- 分别显示系统适配、32 位服务响应及 SELinux 状态。
- 检查完整系统版本、网络组件哈希、内核接口、本次开机的运行库挂载、binfmt 注册与 ARM32 ABI。
- 显示机型、Android 版本、处理器、内核和运行时间；每项异常附有处理建议。
- 手动刷新、生成并复制诊断摘要、按需查看最近 120 行启动日志。支持深色模式和窄屏。

页面通过 [KernelSU WebUI 接口](https://kernelsu.org/zh_CN/guide/module-webui.html) 调用固定的只读检测命令，在 init 挂载命名空间读取状态。探针只查询 zygote ABI，不启动应用。所有页面资源随模块打包，无 CDN、联网请求或遥测，不提供修改属性、重启服务等控制操作。摘要不采集序列号和应用列表；日志可能包含应用路径，分享前请检查。

普通浏览器无法获取 root 检测数据，会明确显示无法连接管理器；读取失败或超时不会继续显示历史“正常”状态。模块状态文件仅作为诊断记录，绿色状态需要当前挂载及服务探测通过。停用或卸载尚未重启时会显示待生效提示。

### 管理模块

在受支持的设备上，通过 KernelSU 兼容管理器安装模块 ZIP，重启后使用模块的 Action 查看状态。停用或卸载模块并重启可撤销运行时挂载。模块 ID 保持 `tango32_findx9u`，用于覆盖此前个人测试版。

OTA 后应先停用模块，确认新系统兼容性后再启用。适配其他机型或版本需要重新检查内核接口、init 服务、ART/APEX、运行库及应用实测，仅相同版本号不足以判断兼容。

## 验证情况与已知问题

### 0.3.1-test：安装属性与兼容层优化

新增 `system.prop`，内容仅为 `ro.sys.oplus_support_app32_version=2`。这是安装支持声明，模块启用后由管理器加载；即使运行环境未就绪，该属性也可能已经生效，请以 WebUI 的挂载和服务检查为准。

ARM32 文件描述符兼容层增加每线程单条路径缓存，避免重复恢复同一路径时反复扫描 `/proc/self/mountinfo`。每次命中都重新核对文件的设备号和 inode；路径消失、文件身份变化或 FD 复用时回退到原有扫描逻辑。缓存不跳过 Zygote 的原有安全检查。

合成回归测试中，同一路径连续解析 1001 次只扫描一次挂载表；这表示该兼容分支减少了重复工作，不代表应用整体提速倍数，也不保证提高游戏帧率。尚未用新版运行库重新完成游戏实测。

实机原有 JIT 已启用，后台 dexopt 为 `speed-profile`，因此保留系统编译策略；不额外修改全局 ART 堆大小、CPU 调度或 GPU 属性。有关系统编译策略可参阅 [Android ART 配置说明](https://source.android.com/docs/core/runtime/configure)。

### 既有运行验证

- 此前 `0.2.0-test` 在上述设备上完成过重启、ARM32 zygote 查询及游戏进入实机场景的测试。
- 已处理测试中遇到的 WebView / 网络 Java 组件不匹配问题。
- 仍记录过一次重启后首次启动的 RenderThread `SIGSEGV`，位置在 `libandroid_runtime.so`；根因尚未确认，后续启动曾正常进入游戏。不能保证所有应用稳定运行。
- `0.2.1-test` 引入仓库构建流程与项目命名；CI 成功只证明编译、镜像检查及打包成功，不等于新产物已完成手机实测。

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
