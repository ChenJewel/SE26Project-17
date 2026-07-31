package com.ueat.app;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileInputStream;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private final Map<Long, PendingApkDownload> pendingApkDownloads = new HashMap<>();
    private DownloadManager downloadManager;
    private BroadcastReceiver downloadReceiver;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        downloadManager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
        bridge.getWebView().addJavascriptInterface(new UeatNativeBridge(), "UeatNative");
        registerDownloadReceiver();
    }

    @Override
    public void onDestroy() {
        if (downloadReceiver != null) {
            try {
                unregisterReceiver(downloadReceiver);
            } catch (IllegalArgumentException ignored) {
                // Receiver may already be unregistered by the system.
            }
        }
        super.onDestroy();
    }

    private void registerDownloadReceiver() {
        downloadReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) return;
                long downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
                PendingApkDownload pending = pendingApkDownloads.remove(downloadId);
                if (pending == null) return;
                verifyAndInstall(downloadId, pending);
            }
        };

        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(downloadReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(downloadReceiver, filter);
        }
    }

    private void verifyAndInstall(long downloadId, PendingApkDownload pending) {
        Uri downloadedUri = downloadManager.getUriForDownloadedFile(downloadId);
        if (downloadedUri == null || !pending.file.exists()) {
            showToast("安装包下载失败，请重新下载。");
            return;
        }

        if (!pending.sha256.isEmpty() && !pending.sha256.equalsIgnoreCase(calculateSha256(pending.file))) {
            pending.file.delete();
            showToast("安装包校验失败，请重新下载。");
            return;
        }

        Uri apkUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", pending.file);
        Intent installIntent = new Intent(Intent.ACTION_VIEW)
            .setDataAndType(apkUri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            startActivity(installIntent);
        } catch (Exception error) {
            showToast("无法打开安装页面，请允许安装未知来源应用后重试。");
        }
    }

    private String calculateSha256(File file) {
        try (FileInputStream input = new FileInputStream(file)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
            byte[] hash = digest.digest();
            StringBuilder builder = new StringBuilder();
            for (byte value : hash) {
                builder.append(String.format(Locale.US, "%02x", value));
            }
            return builder.toString();
        } catch (Exception error) {
            return "";
        }
    }

    private void showToast(String message) {
        runOnUiThread(() -> Toast.makeText(this, message, Toast.LENGTH_SHORT).show());
    }

    private final class UeatNativeBridge {
        @JavascriptInterface
        public String getAppInfo() {
            try {
                PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
                long versionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode;
                JSONObject payload = new JSONObject();
                payload.put("platform", "android");
                payload.put("versionCode", versionCode);
                payload.put("versionName", info.versionName);
                payload.put("channel", "official");
                return payload.toString();
            } catch (Exception error) {
                return "{\"platform\":\"android\",\"versionCode\":0,\"versionName\":\"unknown\",\"channel\":\"official\"}";
            }
        }

        @JavascriptInterface
        public void downloadAndInstallApk(String payloadJson) {
            try {
                JSONObject payload = new JSONObject(payloadJson);
                String apkUrl = payload.optString("apkUrl", "").trim();
                if (apkUrl.isEmpty()) {
                    showToast("当前没有可下载的安装包。");
                    return;
                }

                int versionCode = Math.max(0, payload.optInt("versionCode", 0));
                String versionName = payload.optString("versionName", String.valueOf(versionCode)).replaceAll("[^0-9A-Za-z._-]", "_");
                File directory = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "updates");
                if (!directory.exists() && !directory.mkdirs()) {
                    showToast("无法创建下载目录。");
                    return;
                }
                File apkFile = new File(directory, "u-eat-" + versionName + "-" + versionCode + ".apk");
                if (apkFile.exists()) apkFile.delete();

                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(apkUrl))
                    .setTitle("U eat " + versionName)
                    .setDescription("正在下载最新安装包")
                    .setMimeType("application/vnd.android.package-archive")
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationUri(Uri.fromFile(apkFile));

                long downloadId = downloadManager.enqueue(request);
                pendingApkDownloads.put(downloadId, new PendingApkDownload(apkFile, payload.optString("apkSha256", "").trim()));
                showToast("已开始下载更新。");
            } catch (Exception error) {
                showToast("下载启动失败，请稍后再试。");
            }
        }
    }

    private static final class PendingApkDownload {
        final File file;
        final String sha256;

        PendingApkDownload(File file, String sha256) {
            this.file = file;
            this.sha256 = sha256;
        }
    }
}
