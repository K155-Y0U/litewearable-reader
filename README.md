# 腕上阅读（litewearable-reader）

华为轻智能手表（Lite Wearable）上的本地 TXT 阅读器

## 功能

阅读

## 构建

- DevEco Studio 3.1 及以上 `compileSdkVersion 6`，`compatibleSdkVersion 6`。

填写自己的 `.p12`、`.p7b`、`.cer` 路径和密码。

## WearEngine 传输

手表端在 `pages/trans/trans.js` 中配置手机应用身份：

```js
peerPkgName: '你的手机端app包名',
peerFingerPrint: '你的手机端app的sha256'
```

- 传输时手表必须停留在传输页，离开页面会注销接收器。

## 第三方组件

- WearEngine-LiteWearable SDK：华为，Apache License 2.0，文件位于 `entry/src/main/js/default/pages/wearengine.js`。
