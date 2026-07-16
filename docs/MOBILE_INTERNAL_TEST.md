# 移动端内部测试

项目当前支持两种移动端内部测试方式：

1. PWA：将 `web/dist` 部署到 HTTPS 静态站点，测试人员通过手机浏览器访问并添加到主屏幕。
2. Android APK：使用 `web/android` 中的 Capacitor 工程构建并安装 APK。

## 构建 Web/PWA

```bash
cd web
npm install
npm run build
```

构建产物位于 `web/dist/`。PWA 测试需要 HTTPS 环境，以确保 Service Worker 正常工作。

## 构建 Android APK

准备 Android Studio、Android SDK 和兼容的 Java 环境，然后执行：

```bash
cd web
npm install
npm run app:sync-android
npm run app:open-android
```

上述命令会构建 Web 资源、同步到 `web/android/` 并打开 Android Studio。完成 Gradle 同步后，可从 Android Studio 构建 debug APK。

典型输出位置：

```text
web/android/app/build/outputs/apk/debug/app-debug.apk
```

## 自动发布测试包

`.github/workflows/android-release.yml` 支持手动触发，也会在推送 `v*` 标签时运行。工作流会：

1. 检查并构建 Web 客户端；
2. 同步 Capacitor Android 工程；
3. 使用 GitHub Actions Secrets 中的签名信息构建 APK；
4. 生成 SHA-256 校验文件；
5. 上传构建产物并创建 GitHub Release。

发布签名需要配置以下 Secrets：

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

签名文件和密码不得提交到仓库。

## 测试提示

- Android 测试人员安装内部 APK 时，可能需要允许“从此来源安装应用”。
- iOS 暂未提供原生工程，测试人员应使用 PWA。
- 测试云端 API 时，应确认客户端的 API 与 WebSocket 地址可被手机访问，不能使用手机自身的 `127.0.0.1`。
