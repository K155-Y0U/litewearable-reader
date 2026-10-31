# 腕上阅读（litewearable-reader）

华为轻智能手表（Lite Wearable）上的本地 TXT 阅读器，使用 FA 模型 + HML/CSS/JavaScript，运行于 ArkUI.Lite / JerryScript。

手机端通过 WearEngine 将 TXT 发送到手表，手表保存到 `internal://app/`，书架扫描后即可阅读。

## 功能

- 扫描 `internal://app/` 下的本地 TXT 书籍，点击阅读，长按删除。
- 窗口化分页阅读，滑动翻页，断点进度保存。
- WearEngine 文件接收：自动处理 `internal://app/` 与 `internal://cache/`，文件就绪后书架可见。
- 顶部状态栏显示时间、电量、阅读百分比和页码。
- 传输页显示连接状态和接收日志。

## 工程结构

```text
entry/src/main/config.json                 页面注册、设备类型、版本
entry/src/main/js/default/app.js           应用生命周期
entry/src/main/js/default/pages/index/     书架
entry/src/main/js/default/pages/read/      阅读页
entry/src/main/js/default/pages/trans/     WearEngine 文件接收
entry/src/main/js/default/pages/wearengine.js  WearEngine-LiteWearable SDK
```

## 构建

- DevEco Studio 3.1 及以上（当前工程为 Gradle 构建，`compileSdkVersion 7`，`compatibleSdkVersion 6`）。
- Lite Wearable 必须手动签名，不能使用自动签名；手表通过“应用调测助手”安装。
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
peerPkgName: 'lite.wearable.reader',
peerFingerPrint: 'lite.wearable.reader_...'
```

- `peerPkgName` 是手机侧应用包名。
- `peerFingerPrint` 必须与手机侧签名证书指纹、AGC/Wear Engine 配置严格一致。
- 手机侧需要申请 Wear Engine 服务权限。
- 传输时手表必须停留在传输页，离开页面会注销接收器。
- 低版本固件可能先把文件写入 `internal://cache/`，接收页会尝试 `move`，失败后 `copy` 到 `internal://app/`。
- 只处理 `.txt` 文件；其他类型会显示忽略日志。

## 阅读器说明

阅读页不再把整本书读入 `fullText`。当前实现按页读取：

- 每次从当前页字节偏移读取约 2KB，只保留当前窗口。
- 下一页根据当前页的 UTF-8 字节长度直接 seek。
- 上一页读取当前位置之前的 1KB，取最后约一页文本。
- 进度保存为 `字节偏移,页码`。
- 进度 key 使用书名哈希 `p2_<hash>`，避免超过 `@system.storage` 的 32 字符 key 限制。
- 页面销毁时停止定时器、保存进度并释放窗口文本。

这样可以避免长篇小说在 64KB / 256KB JS heap 设备上因全文累积而崩溃。仍建议在目标真机上用 1MB、5MB 的 UTF-8 TXT 做压力测试。

## 已知限制

- `@system.file.readText` 只支持 UTF-8。GBK 编码的 TXT 需要在手机端转换为 UTF-8 后再发送。
- 阅读页仍按固定字符数分页，尚未按行高/字号动态排版。
- `file.delete`、`file.copy`、WearEngine 接收和缓存迁移必须在目标手表上验证；模拟器不能替代真机。
- 当前为轻智能手表 FA/JS 工程，不能直接迁移为 ArkTS/Stage 工程；Watch 5 等“智能穿戴”设备需要单独开发。
- 旧提交中可能仍包含早期本机签名路径；如果仓库公开，建议轮换签名材料。

## 第三方组件

- WearEngine-LiteWearable SDK：华为，Apache License 2.0，文件位于 `entry/src/main/js/default/pages/wearengine.js`。
- 拼音输入法页面此前参考/集成自 [alone-86/LiteWearable_InputMethod](https://github.com/alone-86/LiteWearable_InputMethod)。当前版本不使用跨应用读取，因此未包含输入法页面；如需包名/文本输入可重新引入该组件并保留其许可证。
