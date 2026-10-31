# 腕上阅读（litewearable-reader）

华为轻智能手表（Lite Wearable）上的 TXT 阅读器，使用 FA 模型 + HML/CSS/JavaScript，运行于 ArkUI.Lite / JerryScript。

## 功能

- 扫描 `internal://app/` 下的本地 TXT 书籍，点击阅读，长按删除。
- 分页阅读，滑动翻页，断点进度保存。
- 跨应用读取：输入目标应用包名，浏览其沙箱目录，直接打开或复制 TXT 到本应用。
- 内置拼音/英文/符号输入法（`pages/pinyin`、`pages/pinyincandidate`），用于输入包名。
- 顶部状态栏显示时间、电量、阅读百分比和页码。

## 工程结构

```text
entry/src/main/config.json                 页面注册、设备类型、版本
entry/src/main/js/default/app.js           应用生命周期
entry/src/main/js/default/pages/index/     书架
entry/src/main/js/default/pages/read/      阅读页
entry/src/main/js/default/pages/trans/     跨应用入口
entry/src/main/js/default/pages/filelist/  跨应用文件列表与复制
entry/src/main/js/default/pages/pinyin/    输入法
entry/src/main/js/default/pages/pinyincandidate/ 候选字
```

## 构建

- DevEco Studio 3.1 及以上（当前工程为 Gradle 构建，`compileSdkVersion 7`，`compatibleSdkVersion 6`）。
- Lite Wearable 必须手动签名，不能使用自动签名；手表通过“应用调测助手”安装。

签名配置不在仓库中：

```text
copy signing.gradle.example signing.gradle
```

然后填写本机的 `.p12`、`.p7b`、`.cer` 路径和密码。`signing.gradle`、`local.properties`、构建产物和日志均已被 `.gitignore` 忽略。

命令行构建可使用：

```powershell
.\gradlew.bat :entry:assembleDebug
```

已验证构建产物：

```text
entry/build/outputs/hap/debug/entry-bin-debug-lite-signed.hap
```

实际产物路径以 DevEco 构建日志为准。构建时需要使用 JDK 17 或 DevEco 自带 JBR；JDK 25 与 Gradle 7.3 不兼容。

## 阅读器说明

阅读页不再把整本书读入 `fullText`。当前实现按页读取：

- 每次从当前页字节偏移读取约 2KB，只保留当前窗口。
- 下一页根据当前页的 UTF-8 字节长度直接 seek。
- 上一页读取当前位置之前的 1KB，取最后约一页的文本。
- 进度保存为 `字节偏移,页码`，key 使用书名哈希，避免超过 `@system.storage` 的 32 字符 key 限制。
- 页面销毁时停止定时器、保存进度并释放窗口文本。

这样可以避免长篇小说在 64KB / 256KB JS heap 设备上因全文累积而崩溃。仍建议在目标真机上用 1MB、5MB 的 UTF-8 TXT 做压力测试。

## 已知限制

- `@system.file.readText` 只支持 UTF-8。GBK 编码的 TXT 需要在手机端转换为 UTF-8 后再导入。
- 跨应用读取依赖 `internal://app/..\<包名>\...` 路径，属于实验能力；不同固件/应用沙箱策略可能不同，必须真机验证。
- 跨应用复制优先使用 `file.copy`，失败时退回 2KB 分块读写；复制过程中请停留在文件列表页。
- 阅读页仍按固定字符数分页，尚未按行高/字号动态排版。
- 当前为轻智能手表 FA/JS 工程，不能直接迁移为 ArkTS/Stage 工程；Watch 5 等“智能穿戴”设备需要单独开发。
- 旧提交中可能仍包含早期本机签名路径；如果仓库公开，建议轮换签名材料。

## 输入法来源

`pages/pinyin` 与 `pages/pinyincandidate` 的说明和原始用法见 `entry/src/main/js/default/pages/README.md`，许可证见同目录 `LICENSE`。
