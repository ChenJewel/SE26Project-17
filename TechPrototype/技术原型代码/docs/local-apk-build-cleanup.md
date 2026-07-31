# 本地 APK 构建环境清理提醒

本项目为了在本机打包 Android APK，会临时使用一些本地构建工具和缓存。它们不属于业务代码，已经通过 `.gitignore` 避免误上传。

## 可以保留的文件

- `web/android/`：Capacitor 生成的 Android 工程，需要提交到代码仓库。
- `web/.env.capacitor`：APK 构建使用的 API / WebSocket 地址配置，按项目需要决定是否提交。
- `web/package.json`、`web/package-lock.json`：Capacitor 依赖和脚本配置，需要提交。

## 项目结束后可以删除的本地文件

- `D:\U eat\.tools\`：本机隔离安装的 JDK、Android SDK、命令行工具。
- `C:\Users\user\.gradle\`：Gradle 下载依赖和 wrapper 缓存。
- `D:\U eat\web\android\local.properties`：本机 Android SDK 路径配置，只对当前电脑有效。
- `D:\U eat\web\android\app\build\`：Android 构建输出目录。
- `D:\U eat\web\android\.gradle\`：Android 工程本地 Gradle 缓存。
- `D:\U eat\web\dist\`：前端构建输出，可重新生成。

## 不建议删除的内容

- 不要删除 `web/android/gradle/`、`web/android/gradlew`、`web/android/gradlew.bat`，这些是项目构建脚本。
- 不要删除 `web/src/`、`server/`、`docs/`、`TechPrototype/` 等业务代码和文档。

## 备注

这些本地工具主要占用硬盘空间，不会长期占用内存。打包 APK 时才会临时运行 Java、Gradle 和 Android 构建进程。
