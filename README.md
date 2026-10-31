# 腕上阅读（litewearable-reader）

华为轻智能手表（Lite Wearable）上的本地 TXT 阅读器，使用 FA 模型 + HML/CSS/JavaScript，运行于 ArkUI.Lite / JerryScript。

手机端通过 WearEngine 将 TXT 发送到手表，手表保存到 `internal://app/`，书架扫描后即可阅读。

## 功能

- 扫描 `internal://app/` 下的本地 TXT 书籍，点击阅读，长按删除。
- 分块加载 + 固定字符分页，滑动翻页，断点进度保存。
- 阅读页内置深色阅读背景，正文显示在背景图上。
- 设置页可查看当前背景、恢复默认背景、跳转传输页更换背景。
- WearEngine 文件接收：自动处理 `internal://app/` 与 `internal://cache/`，文件就绪后书架可见。
- 阅读页顶部显示时间、电量和当前页内容。
- 传输页显示连接状态和接收日志。

## 工程结构

```text
entry/src/main/js/default/pages/index/     书架
entry/src/main/js/default/pages/read/      阅读页
entry/src/main/js/default/pages/trans/     WearEngine 文件接收
entry/src/main/js/default/pages/setting/   设置页（阅读背景管理）
entry/src/main/js/default/pages/wearengine.js  WearEngine-LiteWearable SDK
entry/src/main/js/default/common/          背景图、.bin 校验、共享资源
```

## 构建

- DevEco Studio 3.1 及以上，`compileSdkVersion 7`，`compatibleSdkVersion 6`。
- 构建使用 JDK 17 或 DevEco 自带 JBR；JDK 25 与 Gradle 7.3 不兼容。

签名配置不在仓库中：

```text
copy signing.gradle.example signing.gradle
```

然后填写本机的 `.p12`、`.p7b`、`.cer` 路径和密码。`signing.gradle`、`local.properties`、构建产物和日志均已被 `.gitignore` 忽略。

命令行构建：

```powershell
.\gradlew.bat :entry:assembleDebug
```

已验证构建产物：

```text
entry/build/outputs/hap/debug/entry-bin-debug-lite-signed.hap
```

实际产物路径以 DevEco 构建日志为准。

## WearEngine 传输

手表端在 `pages/trans/trans.js` 中配置手机应用身份：

```js
peerPkgName: 'tool.weilan.jsreader',
peerFingerPrint: 'tool.weilan.jsreader_A75229A39DDE148CD01E1A9306ABDC5B283139CEDA7F2210D37F3097FA9A5B90'
```

手机端配套 App 位于：

```text
D:\project\read\jsreader
```

- `peerPkgName` 是手机侧应用包名，当前为 `tool.weilan.jsreader`。
- `peerFingerPrint` 必须与手机侧签名证书指纹、AGC/Wear Engine 配置严格一致。
- 手机端重新签名后，需要同步修改 `trans.js` 和手机端 `WATCH_EXPECTED_PHONE_FINGER`。
- 手机端选择背景图片后会自动转换为 466×466 的 Lite `.bin` 再发送。
- 手机侧需要申请 Wear Engine 服务权限。
- 传输时手表必须停留在传输页，离开页面会注销接收器。
- 低版本固件可能先把文件写入 `internal://cache/`，接收页会尝试 `move`，失败后 `copy` 到 `internal://app/`。
- `.txt` 保存到书架；有效的 Lite `.bin` 保存为阅读背景；其他类型会显示忽略日志。

## 阅读器说明

当前阅读页使用已经验证可正常显示的 old baseline 方案：

- 按 1000 单位分块调用 `file.readText`，顺序追加到页面文本。
- 每页固定 90 个字符。
- 进度按当前字符索引保存，使用书名哈希作为 storage key，避免超过 32 字符限制。
- `onDestroy` 停止定时器并释放全文文本。

这个方案优先保证兼容性和正常显示，但会把整本书逐步读入内存。对于超大 TXT，64KB / 256KB heap 设备仍可能内存不足。后续如需优化，应先在目标真机上验证 `readText` 的 `position/length` 单位和分页 seek 行为，再改窗口化读取。

## 阅读背景

阅读页使用 `stack` 叠放背景图和正文：

```html
<stack class="read-stack">
    <image class="read-bg" src="{{ backgroundImage }}" />
    <div class="container" onswipe="handleSwipe">...</div>
</stack>
```

### 内置背景

- 默认背景位于 `entry/src/main/js/default/common/read_bg.png`，按 Lite 规范使用 `/common/...` 绝对路径。
- 当前素材为 336×336 的深色渐变图，解码约 0.43 MiB。
- 图片文件名保持英文 ASCII；替换时保持文件名和引用一致。

### 自定义背景

Lite Wearable 的 `internal://app/` 图片只能使用构建链生成的 `.bin` 格式，不能直接放 PNG/JPG。手机通过 WearEngine 发送 `.bin` 即可更新阅读背景。

转换工具：

```powershell
.\tools\convert-to-litebin.ps1 -InputPath .\background.png -OutputPath .\custom_bg.bin -Size 466
```

- 输入支持 PNG/JPG/BMP，输出为 Lite `.bin`。
- 建议尺寸 466×466，最大 512×512。
- Android 手机端 `D:\project\read\jsreader` 的“选择阅读背景图片”也会自动执行同样的转换。
- `.bin` 格式：8 字节头（magic `256`、`width | (height << 16)`）+ BGRA 像素，每像素 4 字节。
- 发送生成后的 `.bin` 文件到手表传输页。
- 文件固定保存为 `internal://app/custom_bg.bin`，路径写入 storage 的 `bg_path`。
- 传输时会校验 `.bin` 头、尺寸和文件长度；无效文件会被拒绝并删除临时文件。
- 阅读页打开时读取 `bg_path`，再次校验后绑定到 `<image src="{{backgroundImage}}">`；失败回退内置背景。
- 设置页显示当前背景和预览，可恢复默认背景；恢复时会删除自定义文件并清空 `bg_path`。
- 传输页只负责接收，不再放背景重置按钮。

注意：`internal://app/*.bin` 图片渲染和图片池占用必须真机验证。README 中的内置背景 `/common/read_bg.png` 会在构建时自动转换为 `read_bg.bin`，和应用内固定资源不是同一条路径。

## 已知限制

- `@system.file.readText` 只支持 UTF-8。GBK 编码的 TXT 需要在手机端转换为 UTF-8 后再发送。
- 阅读页按固定字符数分页，尚未按行高/字号动态排版。
- `file.delete`、`file.copy`、WearEngine 接收和缓存迁移必须在目标手表上验证；模拟器不能替代真机。
- 当前为轻智能手表 FA/JS 工程，不能直接迁移为 ArkTS/Stage 工程；Watch 5 等“智能穿戴”设备需要单独开发。
- 旧提交中可能仍包含早期本机签名路径；如果仓库公开，建议轮换签名材料。

## 第三方组件

- WearEngine-LiteWearable SDK：华为，Apache License 2.0，文件位于 `entry/src/main/js/default/pages/wearengine.js`。
- 拼音输入法页面此前参考/集成自 [alone-86/LiteWearable_InputMethod](https://github.com/alone-86/LiteWearable_InputMethod)。当前版本不使用跨应用读取，因此未包含输入法页面；如需包名/文本输入可重新引入该组件并保留其许可证。
