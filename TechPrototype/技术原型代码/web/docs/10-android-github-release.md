# Android GitHub Release 打包与更新发布

当前 Android 包名：`com.ueat.app`。

## 标准发版流程

1. 合并代码到 `main`。
2. 创建一个递增的新 tag，例如：

```bash
git tag v0.2.8
git push origin v0.2.8
```

不要复用已经发布给用户的旧 tag。App 内更新依赖 `versionCode` 递增，`v0.2.7` 会生成 `2007`，`v0.2.8` 会生成 `2008`；同名版本即使 APK 内容变了，已安装用户通常也不会被识别为“有更新”。

也可以在 GitHub Actions 页面手动运行 `Android Release APK`，输入 `v0.2.8` 这种 tag。

## GitHub Secrets

仓库需要配置这些 Secrets：

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

生成 keystore 后，把 keystore 文件转成 base64 填入 `ANDROID_KEYSTORE_BASE64`：

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("ueat-release.jks"))
```

本地也可以运行脚本生成 keystore 和 Secrets 文本：

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\web\scripts\create-android-keystore.ps1
```

`web/android/app/ueat-release.jks` 不要提交到 Git。

## APK 同步到 U eat 服务器

GitHub Actions 会先构建 APK 并发布到 GitHub Release。workflow 里保留了一个 best-effort SSH mirror：如果 GitHub runner 能访问服务器，会顺手同步；如果访问不到，只给 warning，不让 APK 构建发布失败。

线上服务器会通过 `ueat-android-release-sync.timer` 主动从 GitHub Release 拉取最新 APK、sha256 和 `app-version.json`，写入 `/opt/ueat/downloads/app-version-manifest.json`，让 `/api/app/version/latest` 检测到新版本。

服务器默认每 10 分钟检查一次。需要立刻同步时，在服务器上执行：

```bash
systemctl start ueat-android-release-sync.service
```

如果日志出现：

```text
Server mirror failed: ssh-keyscan could not reach the mirror host
```

说明 GitHub 托管 runner 连不到部署主机。常见原因是部署主机位于校园网、内网或防火墙后面；这不是 Node 版本问题，也不是 APK 构建失败。只要 GitHub Release 已经发布成功，服务器定时器会从服务器侧主动拉取，不需要开发者本机补跑同步命令。

同步后验证：

- `http://10.119.5.83/` 返回 200
- `http://10.119.5.83/api/health` 正常
- `http://10.119.5.83/api/app/version/latest` 返回新版本号

## 更新检测规则

App 侧通过 `versionCode` 判断是否有更新：

- 当前安装包 `versionCode < latestVersionCode`：显示更新。
- 当前安装包 `versionCode >= latestVersionCode`：不显示更新。

所以发布给用户时建议每次使用新 tag，例如 `v0.2.8`、`v0.2.9`，而不是重新推同一个 `v0.2.7`。

## 安装注意

- 后续升级必须继续使用同一个 keystore。
- `versionName` 来自 tag，例如 `v0.2.8` 显示为 `0.2.8`。
- GitHub Actions 使用 Java 21；本地如果 Java 版本太新导致 Gradle 报错，切到 Java 21 再构建。
