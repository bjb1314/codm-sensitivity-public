# 手感刻度 CODM Android 版

横屏应用，网页和数据均保存在设备本地。无需网络权限。Android 7.0 或以上，要求系统 WebView 可用。

应用向 Android 声明为游戏，以便游戏助手识别。若 realme 手机或一加平板没有自动添加，可在设备的游戏中心或游戏空间中手动添加「手感刻度 CODM」，再按设备提供的选项开启触控优化。是否识别、触控采样和灵敏度设置由设备系统决定，应用无法强制修改。应用会请求适合当前分辨率的 60–144 Hz 显示模式，实际刷新率由设备决定。

使用 Android SDK 的 aapt、javac、d8、zipalign 和 apksigner 构建。assets/index.html 基于仓库网页生成，插入本地剪贴板适配。

签名密钥应由发布者自行保管，不包含在源码包内。不同密钥签名的版本不能直接覆盖安装。

构建：设置 ANDROID_SDK_ROOT 和 JAVA_HOME，安装 Android SDK Platform 36.1 与 Build Tools 36.0.0，再运行 PowerShell 脚本 build.ps1。脚本使用本机 Android 调试签名。
