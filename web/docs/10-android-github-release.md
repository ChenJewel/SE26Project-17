# Android GitHub Release 打包

当前 Android 包名：`com.ueat.app`。

## 发版方式

推送 tag 后会自动构建 APK 并上传到 GitHub Release：

```bash
git tag v0.1.0
git push origin v0.1.0
```

也可以在 GitHub Actions 页面手动运行 `Android Release APK`，输入版本号如 `v0.1.0`。

## GitHub Secrets

仓库需要配置这些 Secrets：

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

生成 keystore 后，把 keystore 文件转成 base64，填入 `ANDROID_KEYSTORE_BASE64`。

PowerShell 示例：

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("ueat-release.jks"))
```

本地也可以运行脚本生成 keystore 和 Secrets 文本：

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\web\scripts\create-android-keystore.ps1
```

脚本会在 `web/android/app/ueat-release.jks` 生成签名文件，并输出需要填入 GitHub Secrets 的值。这个 `.jks` 文件不要提交到 Git。

## 安装方式

Release 生成后，用户下载 `ueat-v版本号.apk`，在 Android 手机上允许“安装未知来源应用”即可安装。

注意：

- 后续升级必须继续使用同一个 keystore。
- `versionCode` 由 GitHub Actions run number 自动递增。
- `versionName` 来自 tag，例如 `v0.1.0` 会显示为 `0.1.0`。
- GitHub Actions 使用 Java 21；本地如果安装了 Java 25，Gradle 可能报 `Unsupported class file major version 69`，切到 Java 21 再本地构建。
