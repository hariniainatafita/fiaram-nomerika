package mg.fiaram.nomerika;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Method;
import com.getcapacitor.CallOptions;
import com.getcapacitor.PluginCall;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private ExecutorService executor = Executors.newSingleThreadExecutor();

    @Method
    public void getVersion(PluginCall call) {
        try {
            String packageName = getContext().getPackageName();
            PackageManager pm = getContext().getPackageManager();
            android.content.pm.PackageInfo pi = pm.getPackageInfo(packageName, 0);
            long versionCode = pi.versionCode;
            String versionName = pi.versionName;
            JSObject result = new JSObject();
            result.put("versionCode", versionCode);
            result.put("versionName", versionName);
            call.resolve(result);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @Method
    public void checkForUpdate(PluginCall call) {
        String updateUrl = call.getString("updateUrl");
        if (updateUrl == null || updateUrl.isEmpty()) {
            call.reject("updateUrl is required");
            return;
        }
        executor.execute(() -> {
            try {
                URL url = new URL(updateUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(30000);
                conn.setRequestProperty("User-Agent", "FIARAM-NOMERIKA-Android");
                conn.setInstanceFollowRedirects(true);
                conn.connect();
                int code = conn.getResponseCode();
                if (code < 200 || code >= 300) {
                    call.reject("HTTP " + code);
                    return;
                }
                // Simple JSON parsing via string search for brevity
                // We'll look for "apkUrl":"..." etc.
                String body = new String(conn.getInputStream().readAllBytes());
                String apkUrl = extractJsonString(body, "apkUrl");
                long versionCode = extractJsonLong(body, "versionCode");
                String versionName = extractJsonString(body, "versionName");
                String notes = extractJsonString(body, "notes");
                if (apkUrl == null) {
                    call.reject("apkUrl not found in update.json");
                    return;
                }
                JSObject result = new JSObject();
                result.put("available", true);
                result.put("currentVersionCode", getCurrentVersionCode());
                result.put("currentVersionName", getCurrentVersionName());
                result.put("latestVersionCode", versionCode);
                result.put("latestVersionName", versionName != null ? versionName : "");
                result.put("notes", notes != null ? notes : "");
                result.put("apkUrl", apkUrl);
                call.resolve(result);
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    @Method
    public void downloadAndInstall(PluginCall call) {
        String apkUrl = call.getString("apkUrl");
        if (apkUrl == null || apkUrl.isEmpty()) {
            call.reject("apkUrl required");
            return;
        }
        executor.execute(() -> {
            try {
                PackageManager pm = getContext().getPackageManager();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                        !pm.canRequestPackageInstalls()) {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                            Uri.parse("package:" + getContext().getPackageName()));
                    getActivity().startActivity(intent);
                    JSObject result = new JSObject();
                    result.put("needsPermission", true);
                    call.resolve(result);
                    return;
                }
                URL url = new URL(apkUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(20000);
                conn.setReadTimeout(40000);
                conn.setRequestProperty("User-Agent", "FIARAM-NOMERIKA-Android");
                conn.setInstanceFollowRedirects(true);
                conn.connect();
                int code = conn.getResponseCode();
                if (code != 200) {
                    call.reject("HTTP " + code);
                    return;
                }
                long totalLen = conn.getContentLengthLong();
                File cacheDir = getContext().getCacheDir();
                File apkFile = new File(cacheDir, "fiaram-update.apk");
                if (apkFile.exists()) apkFile.delete();
                try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(apkFile)) {
                    byte[] buffer = new byte[8192];
                    int n;
                    while ((n = in.read(buffer)) != -1) {
                        out.write(buffer, 0, n);
                    }
                }
                // Verify package
                PackageManager pm2 = getContext().getPackageManager();
                android.content.pm.PackageInfo pi = pm2.getPackageArchiveInfo(apkFile.getAbsolutePath(), 0);
                if (pi == null || !pi.packageName.equals(getContext().getPackageName())) {
                    call.reject("Invalid APK package name");
                    return;
                }
                // Launch installer
                Uri uri = FileProvider.getUriForFile(getContext(),
                        getContext().getPackageName() + ".fileprovider", apkFile);
                Intent installIntent = new Intent(Intent.ACTION_VIEW);
                installIntent.setDataAndType(uri, "application/vnd.android.package-archive");
                installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                installIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    getActivity().startActivity(installIntent);
                } catch (Exception e) {
                    call.reject("Cannot start installer activity");
                    return;
                }
                JSObject result = new JSObject();
                result.put("started", true);
                call.resolve(result);
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    @Method
    public void requestManualUpdateCheck(PluginCall call) {
        // Emitted from JS; do nothing here, the JS side will handle UI.
        call.resolve();
    }

    private long getCurrentVersionCode() {
        try {
            String packageName = getContext().getPackageName();
            PackageManager pm = getContext().getPackageManager();
            android.content.pm.PackageInfo pi = pm.getPackageInfo(packageName, 0);
            return pi.versionCode;
        } catch (Exception e) {
            return 0;
        }
    }

    private String getCurrentVersionName() {
        try {
            String packageName = getContext().getPackageName();
            PackageManager pm = getContext().getPackageManager();
            android.content.pm.PackageInfo pi = pm.getPackageInfo(packageName, 0);
            return pi.versionName;
        } catch (Exception e) {
            return "";
        }
    }

    private String extractJsonString(String json, String key) {
        String pattern = "\"" + key + "\":\"";
        int idx = json.indexOf(pattern);
        if (idx < 0) return null;
        int start = idx + pattern.length();
        int end = json.indexOf("\"", start);
        if (end < 0) return null;
        return json.substring(start, end);
    }

    private long extractJsonLong(String json, String key) {
        String pattern = "\"" + key + "\":";
        int idx = json.indexOf(pattern);
        if (idx < 0) return 0;
        int start = idx + pattern.length();
        int end = json.indexOf(",", start);
        if (end < 0) end = json.indexOf("}", start);
        if (end < 0) return 0;
        try {
            return Long.parseLong(json.substring(start, end).trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}