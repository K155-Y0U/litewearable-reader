# 腕上阅读（litewearable-reader）

华为轻智能手表（Lite Wearable）上的本地 TXT 阅读器

## 功能

- 扫描 `internal://app/` 下的本地 TXT 书籍，点击阅读，长按删除。
- 窗口化分页阅读，滑动翻页，断点进度保存。
- WearEngine 文件接收：自动处理 `internal://app/` 与 `internal://cache/`，文件就绪后书架可见。
- 顶部状态栏显示时间、电量、阅读百分比和页码。
- 传输页显示连接状态和接收日志。

## 构建

- DevEco Studio 3.1 及以上 `compileSdkVersion 6`，`compatibleSdkVersion 6`。

签名配置不在仓库中：

```text
copy signing.gradle.example signing.gradle
```

然后填写本机的 `.p12`、`.p7b`、`.cer` 路径和密码。

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

## 第三方组件

- WearEngine-LiteWearable SDK：华为，Apache License 2.0，文件位于 `entry/src/main/js/default/pages/wearengine.js`。

