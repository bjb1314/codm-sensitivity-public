# 手感刻度 CODM Android 版

横屏应用，网页和数据均保存在设备本地。无需网络权限。Android 7.0 或以上，要求系统 WebView 可用。

使用 Android SDK 的 aapt、javac、d8、zipalign 和 apksigner 构建。assets/index.html 基于仓库网页生成，插入本地剪贴板适配。

签名密钥应由发布者自行保管，不包含在源码包内。不同密钥签名的版本不能直接覆盖安装。

构建：设置 ANDROID_SDK_ROOT 和 JAVA_HOME，安装 Android SDK Platform 36.1 与 Build Tools 36.0.0，再运行 PowerShell 脚本 build.ps1。脚本使用本机 Android 调试签名。
