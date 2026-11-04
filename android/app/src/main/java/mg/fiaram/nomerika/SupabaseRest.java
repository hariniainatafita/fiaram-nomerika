package mg.fiaram.nomerika;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Acces REST minimal a la table app_state de Supabase, utilise par la bulle
 * pour envoyer une reponse rapide sans ouvrir l'application.
 */
final class SupabaseRest {
    private static final String TAG = "FiaramBubble";
    private static final String TABLE = "app_state";
    private static final String MESSAGES_KEY = "fiaram_messages_v2";
    private static final String TOKENS_KEY = "fiaram_device_tokens_v1";

    interface Callback {
        void onResult(boolean success, String error);
    }

    private SupabaseRest() {
    }

    static void sendReply(Context context, String receiverId, String groupId, String text, Callback callback) {
        final String userId = BubbleSession.userId(context);
        final String baseUrl = BubbleSession.supabaseUrl(context);
        final String apiKey = BubbleSession.supabaseKey(context);
        if (userId.isEmpty() || baseUrl.isEmpty() || apiKey.isEmpty()) {
            post(callback, false, "session incomplete");
            return;
        }
        new Thread(() -> {
            try {
                JSONArray current = getRowValue(baseUrl, apiKey, MESSAGES_KEY);
                if (current == null) current = new JSONArray();

                JSONObject message = new JSONObject();
                message.put("id", "msg_" + System.currentTimeMillis() + "_"
                        + Long.toString(System.nanoTime(), 36));
                message.put("sender_id", userId);
                if (receiverId != null && !receiverId.isEmpty()) {
                    message.put("receiver_id", receiverId);
                }
                if (groupId != null && !groupId.isEmpty()) {
                    message.put("group_id", groupId);
                }
                message.put("message", text);
                message.put("status", "sent");
                message.put("is_deleted", false);
                message.put("is_edited", false);
                message.put("sent_at", new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).format(new Date()));
                current.put(message);

                saveRowValue(baseUrl, apiKey, MESSAGES_KEY, current);
                post(callback, true, null);
            } catch (Exception error) {
                Log.w(TAG, "sendReply", error);
                post(callback, false, error.getMessage());
            }
        }, "fiaram-bubble-reply").start();
    }

    static void registerDeviceToken(Context context, String userId, String token, Callback callback) {
        final String baseUrl = BubbleSession.supabaseUrl(context);
        final String apiKey = BubbleSession.supabaseKey(context);
        if (baseUrl.isEmpty() || apiKey.isEmpty() || userId.isEmpty() || token.isEmpty()) {
            post(callback, false, "configuration incomplete");
            return;
        }
        new Thread(() -> {
            try {
                JSONObject registry = getRowObject(baseUrl, apiKey, TOKENS_KEY);
                if (registry == null) registry = new JSONObject();
                JSONArray tokens = registry.optJSONArray(userId);
                if (tokens == null) tokens = new JSONArray();
                boolean exists = false;
                for (int i = 0; i < tokens.length(); i++) {
                    if (token.equals(tokens.optString(i))) {
                        exists = true;
                        break;
                    }
                }
                if (!exists) tokens.put(token);
                registry.put(userId, tokens);
                saveRowValue(baseUrl, apiKey, TOKENS_KEY, registry);
                post(callback, true, null);
            } catch (Exception error) {
                Log.w(TAG, "registerDeviceToken", error);
                post(callback, false, error.getMessage());
            }
        }, "fiaram-bubble-token").start();
    }

    private static JSONArray getRowValue(String baseUrl, String apiKey, String key) throws Exception {
        JSONArray rows = requestRows(baseUrl, apiKey, key);
        if (rows == null || rows.length() == 0) return null;
        JSONObject row = rows.optJSONObject(0);
        if (row == null) return null;
        Object value = row.opt("value");
        if (value instanceof JSONArray) return (JSONArray) value;
        if (value instanceof String) {
            try {
                return new JSONArray((String) value);
            } catch (Exception ignored) {
                return null;
            }
        }
        return null;
    }

    private static JSONObject getRowObject(String baseUrl, String apiKey, String key) throws Exception {
        JSONArray rows = requestRows(baseUrl, apiKey, key);
        if (rows == null || rows.length() == 0) return null;
        JSONObject row = rows.optJSONObject(0);
        if (row == null) return null;
        Object value = row.opt("value");
        if (value instanceof JSONObject) return (JSONObject) value;
        if (value instanceof String) {
            try {
                return new JSONObject((String) value);
            } catch (Exception ignored) {
                return null;
            }
        }
        return null;
    }

    private static JSONArray requestRows(String baseUrl, String apiKey, String key) throws Exception {
        String url = baseUrl.replaceAll("/+$", "") + "/rest/v1/" + TABLE
                + "?key=eq." + URLEncoder.encode(key, "UTF-8") + "&select=value";
        HttpURLConnection connection = open(url, apiKey, "GET");
        try {
            int status = connection.getResponseCode();
            InputStream stream = status >= 200 && status < 300
                    ? connection.getInputStream()
                    : connection.getErrorStream();
            String body = read(stream);
            if (status < 200 || status >= 300) {
                throw new IllegalStateException("Supabase " + status + " : " + body);
            }
            return new JSONArray(body);
        } finally {
            connection.disconnect();
        }
    }

    private static void saveRowValue(String baseUrl, String apiKey, String key, Object value) throws Exception {
        JSONArray rows = requestRows(baseUrl, apiKey, key);
        String base = baseUrl.replaceAll("/+$", "") + "/rest/v1/" + TABLE;
        if (rows != null && rows.length() > 0) {
            String url = base + "?key=eq." + URLEncoder.encode(key, "UTF-8");
            JSONObject body = new JSONObject();
            body.put("value", value);
            body.put("updated_at", nowIso());
            write(url, apiKey, "PATCH", body.toString());
        } else {
            JSONObject body = new JSONObject();
            body.put("key", key);
            body.put("value", value);
            body.put("updated_at", nowIso());
            write(base, apiKey, "POST", body.toString());
        }
    }

    private static String nowIso() {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date());
    }

    private static HttpURLConnection open(String url, String apiKey, String method) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(15000);
        connection.setRequestProperty("apikey", apiKey);
        connection.setRequestProperty("Authorization", "Bearer " + apiKey);
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("Accept", "application/json");
        return connection;
    }

    private static void write(String url, String apiKey, String method, String body) throws Exception {
        HttpURLConnection connection = open(url, apiKey, method);
        connection.setDoOutput(true);
        connection.setRequestProperty("Prefer", "return=minimal");
        try (OutputStream output = connection.getOutputStream()) {
            output.write(body.getBytes(StandardCharsets.UTF_8));
        }
        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            InputStream stream = connection.getErrorStream();
            throw new IllegalStateException("Supabase " + status + " : " + read(stream));
        }
        connection.disconnect();
    }

    private static String read(InputStream stream) throws Exception {
        if (stream == null) return "";
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            StringBuilder builder = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) builder.append(line);
            return builder.toString();
        }
    }

    private static void post(Callback callback, boolean success, String error) {
        if (callback == null) return;
        new Handler(Looper.getMainLooper()).post(() -> callback.onResult(success, error));
    }
}
