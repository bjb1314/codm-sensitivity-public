# 手感刻度 · CODM

一款面向《使命召唤手游》手机和平板玩家的触控灵敏度参考工具。通过横屏靶场中的拖动、定位和跟枪测试，生成可以填写到游戏中的灵敏度起点。

## 下载与使用

- **Android 横屏版**：[下载 APK](shougankedu-codm-landscape.apk)。需要 Android 7.0 或更高版本，以及可用的系统 WebView；安装时按设备提示允许安装下载的应用。
- **网页版**：[下载 HTML 文件](手感刻度-CODM.html)，再用手机、平板或电脑浏览器打开。手机和平板建议横屏使用。
- **其他下载**：前往 [Releases](../../releases) 查看发布版本与附件。

## 如何使用

1. 根据设备、指法和拇指行程填写习惯。
2. 横屏进入靶场，按住并拖动屏幕，让准星碰到目标；无需点击射击。
3. 完成三档测试后，查看并复制镜头和开火灵敏度，填入游戏的「设置 → 灵敏度」。

游戏内推荐选择**固定速度**。使命召唤手游的灵敏度为整数，方案是估算起点，可在训练场根据手感继续微调。

## 源码与构建

- [Android 源码目录](android/)：包含 Java、Android 配置、构建脚本和内置网页；构建要求见 [Android 说明](android/README.md)。
- [Android 源码压缩包](codm-android-source.zip)。
- [网页项目源码压缩包](codm-source.zip)：包含 TanStack Start、React、Tailwind CSS 和 Vite 项目源码。

网页项目解压后，安装 Node.js 和 npm，在源码目录运行：

```bash
npm install
npm run dev
```

按终端显示的地址打开网页。开发检查使用 `npm run typecheck`，构建使用 `npm run build`。

## 数据与版本

测试数据保存在当前浏览器或应用的本地存储中。Android 版不申请网络权限；清除浏览器或应用数据可能会删除本地记录。APK 使用调试签名，不同签名的版本通常不能直接覆盖安装。
