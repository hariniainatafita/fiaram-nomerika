package mg.pro.num.tld;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void getVersion(PluginCall call) {
        try {
            JSObject result = new JSObject();
            result.put("versionCode", getCurrentVersionCode());
            result.put("versionName", getCurrentVersionName());
            result.put("selfUpdate", BuildConfig.SELF_UPDATE);
            resolve(call, result);
        } catch (Exception e) {
            reject(call, e.getMessage());
        }
    }

    @PluginMethod
    public void openPlayStore(PluginCall call) {
        String pkg = getContext().getPackageName();
        try {
            Intent market = new Intent(Intent.ACTION_VIEW,
                    Uri.parse("market://details?id=" + pkg));
            market.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(market);
            call.resolve();
        } catch (Exception marketError) {
            try {
                Intent web = new Intent(Intent.ACTION_VIEW,
                        Uri.parse("https://play.google.com/store/apps/details?id=" + pkg));
                web.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(web);
                call.resolve();
            } catch (Exception webError) {
                call.reject(webError.getMessage());
            }
        }
    }

    @PluginMethod
    public void checkForUpdate(PluginCall call) {
        if (!BuildConfig.SELF_UPDATE) {
            JSObject result = new JSObject();
            result.put("available", false);
            result.put("currentVersionCode", getCurrentVersionCode());
            result.put("currentVersionName", getCurrentVersionName());
            result.put("latestVersionCode", 0);
            result.put("latestVersionName", "");
            result.put("notes", "");
            result.put("apkUrl", "");
            result.put("selfUpdate", false);
            resolve(call, result);
            return;
        }
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
                conn.setRequestProperty("User-Agent", "Pro-Num-TLD-Android");
                conn.setInstanceFollowRedirects(true);
                conn.connect();
                int code = conn.getResponseCode();
                if (code < 200 || code >= 300) {
                    reject(call, "HTTP " + code);
                    return;
                }
                String body = readBody(conn.getInputStream());
                String rawApkUrl = extractJsonString(body, "apkUrl");
                long latestVersionCode = extractJsonLong(body, "versionCode");
                String versionName = extractJsonString(body, "versionName");
                String notes = extractJsonString(body, "notes");
                if (rawApkUrl == null || rawApkUrl.isEmpty()) {
                    reject(call, "apkUrl not found in update.json");
                    return;
                }
                String apkUrl = resolveUrl(updateUrl, rawApkUrl);
                long currentVersionCode = getCurrentVersionCode();
                JSObject result = new JSObject();
                result.put("available", latestVersionCode > currentVersionCode);
                result.put("currentVersionCode", currentVersionCode);
                result.put("currentVersionName", getCurrentVersionName());
                result.put("latestVersionCode", latestVersionCode);
                result.put("latestVersionName", versionName != null ? versionName : "");
                result.put("notes", notes != null ? notes : "");
                result.put("apkUrl", apkUrl);
                result.put("selfUpdate", true);
                resolve(call, result);
            } catch (Exception e) {
                reject(call, e.getMessage());
            }
        });
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        if (!BuildConfig.SELF_UPDATE) {
            call.reject("Les mises a jour passent par le Play Store");
            return;
        }
        String apkUrl = call.getString("apkUrl");
        if (apkUrl == null || apkUrl.isEmpty()) {
            call.reject("apkUrl required");
            return;
        }
        executor.execute(() -> {
            try {
                PackageManager pm = getContext().getPackageManager();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                        && !pm.canRequestPackageInstalls()) {
                    Intent intent = new Intent(
                            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                            Uri.parse("package:" + getContext().getPackageName())
                    );
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                    JSObject result = new JSObject();
                    result.put("started", false);
                    result.put("needsPermission", true);
                    resolve(call, result);
                    return;
                }

                URL url = new URL(apkUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(20000);
                conn.setReadTimeout(60000);
                conn.setRequestProperty("User-Agent", "Pro-Num-TLD-Android");
                conn.setInstanceFollowRedirects(true);
                conn.connect();
                int code = conn.getResponseCode();
                if (code != 200) {
                    reject(call, "HTTP " + code);
                    return;
                }

                File apkFile = new File(getContext().getCacheDir(), "pronumtld-update.apk");
                if (apkFile.exists() && !apkFile.delete()) {
                    reject(call, "Cannot replace previous update file");
                    return;
                }
                try (InputStream in = conn.getInputStream();
                     FileOutputStream out = new FileOutputStream(apkFile)) {
                    byte[] buffer = new byte[8192];
                    int n;
                    while ((n = in.read(buffer)) != -1) {
                        out.write(buffer, 0, n);
                    }
                }

                android.content.pm.PackageInfo pi = pm.getPackageArchiveInfo(
                        apkFile.getAbsolutePath(), 0);
                if (pi == null || !getContext().getPackageName().equals(pi.packageName)) {
                    reject(call, "Invalid APK package name");
                    return;
                }

                Uri uri = FileProvider.getUriForFile(
                        getContext(),
                        getContext().getPackageName() + ".fileprovider",
                        apkFile
                );
                Intent installIntent = new Intent(Intent.ACTION_VIEW);
                installIntent.setDataAndType(uri, "application/vnd.android.package-archive");
                installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(installIntent);

                JSObject result = new JSObject();
                result.put("started", true);
                resolve(call, result);
            } catch (Exception e) {
                reject(call, e.getMessage());
            }
        });
    }

    private long getCurrentVersionCode() {
        try {
            PackageManager pm = getContext().getPackageManager();
            android.content.pm.PackageInfo pi = pm.getPackageInfo(
                    getContext().getPackageName(), 0);
            return pi.versionCode;
        } catch (Exception e) {
            return 0;
        }
    }

    private String getCurrentVersionName() {
        try {
            PackageManager pm = getContext().getPackageManager();
            android.content.pm.PackageInfo pi = pm.getPackageInfo(
                    getContext().getPackageName(), 0);
            return pi.versionName;
        } catch (Exception e) {
            return "";
        }
    }

    private void resolve(PluginCall call, JSObject result) {
        getBridge().executeOnMainThread(() -> call.resolve(result));
    }

    private void reject(PluginCall call, String message) {
        getBridge().executeOnMainThread(() -> call.reject(message));
    }

    private static String resolveUrl(String baseUrl, String apkUrl) {
        try {
            return new URL(new URL(baseUrl), apkUrl).toString();
        } catch (Exception e) {
            return apkUrl;
        }
    }

    private static String readBody(InputStream in) throws Exception {
        try (InputStream input = in;
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int n;
            while ((n = input.read(buffer)) != -1) {
                out.write(buffer, 0, n);
            }
            return out.toString("UTF-8");
        }
    }

    private static String extractJsonString(String json, String key) {
        int keyIdx = json.indexOf("\"" + key + "\"");
        if (keyIdx < 0) return null;
        int colon = json.indexOf(':', keyIdx + key.length() + 2);
        if (colon < 0) return null;
        int start = colon + 1;
        while (start < json.length() && Character.isWhitespace(json.charAt(start))) {
            start++;
        }
        if (start >= json.length() || json.charAt(start) != '"') return null;
        start++;
        int end = json.indexOf('"', start);
        if (end < 0) return null;
        return json.substring(start, end);
    }

    private static long extractJsonLong(String json, String key) {
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
