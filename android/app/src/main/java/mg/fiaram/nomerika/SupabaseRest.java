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
 * Acces REST minimal aux lignes de app_state utilisees par le Messenger
 * (messages, membres, groupes, presence et curseurs de lecture). Aucune
 * dependance a Supabase Realtime n'est necessaire : le service interroge les
 * lignes a intervalle regulier.
 */
final class SupabaseRest {
    private static final String TAG = "FiaramBubble";
    private static final String TABLE = "app_state";

    static final String MESSAGES_KEY = "fiaram_messages_v2";
    static final String MEMBERS_KEY = "fiaram_membres_v2";
    static final String GROUPS_KEY = "fiaram_groupes_v2";
    static final String PRESENCE_KEY = "fiaram_presence_online_v1";
    static final String GROUP_READS_KEY = "fiaram_group_reads_v1";
    private static final String TOKENS_KEY = "fiaram_device_tokens_v1";

    interface Callback {
        void onResult(boolean success, String error);
    }

    static final class Row {
        final Object value;
        final String updatedAt;
        final boolean exists;

        Row(Object value, String updatedAt, boolean exists) {
            this.value = value;
            this.updatedAt = updatedAt == null ? "" : updatedAt;
            this.exists = exists;
        }

        static Row empty() {
            return new Row(null, "", false);
        }
    }

    private SupabaseRest() {
    }

    static Row fetchRow(Context context, String key) throws Exception {
        String baseUrl = BubbleSession.supabaseUrl(context);
        String apiKey = BubbleSession.supabaseKey(context);
        if (baseUrl.isEmpty() || apiKey.isEmpty()) return Row.empty();
        JSONArray rows = requestRows(baseUrl, apiKey, key);
        if (rows == null || rows.length() == 0) return Row.empty();
        JSONObject row = rows.optJSONObject(0);
        if (row == null) return Row.empty();
        return new Row(row.opt("value"), row.optString("updated_at", ""), true);
    }

    static void saveValue(Context context, String key, Object value) throws Exception {
        String baseUrl = BubbleSession.supabaseUrl(context);
        String apiKey = BubbleSession.supabaseKey(context);
        if (baseUrl.isEmpty() || apiKey.isEmpty()) {
            throw new IllegalStateException("session incomplete");
        }
        JSONObject body = new JSONObject();
        body.put("key", key);
        body.put("value", value == null ? JSONObject.NULL : value);
        body.put("updated_at", nowIso());
        String base = baseUrl.replaceAll("/+$", "") + "/rest/v1/" + TABLE;
        write(base, apiKey, "POST", body.toString(),
                "resolution=merge-duplicates,return=minimal");
    }

    static JSONArray asArray(Object value) {
        if (value instanceof JSONArray) return (JSONArray) value;
        if (value instanceof String) {
            try {
                return new JSONArray((String) value);
            } catch (Exception ignored) {
                return new JSONArray();
            }
        }
        return new JSONArray();
    }

    static JSONObject asObject(Object value) {
        if (value instanceof JSONObject) return (JSONObject) value;
        if (value instanceof String) {
            try {
                return new JSONObject((String) value);
            } catch (Exception ignored) {
                return new JSONObject();
            }
        }
        return new JSONObject();
    }

    static void sendReply(Context context, String receiverId, String groupId, String text, Callback callback) {
        final String userId = BubbleSession.userId(context);
        if (userId.isEmpty() || !BubbleSession.isReady(context)) {
            post(callback, false, "session incomplete");
            return;
        }
        new Thread(() -> {
            try {
                Row row = fetchRow(context, MESSAGES_KEY);
                JSONArray current = row.exists ? asArray(row.value) : new JSONArray();

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
                message.put("sent_at", nowMinute());
                current.put(message);

                saveValue(context, MESSAGES_KEY, current);
                post(callback, true, null);
            } catch (Exception error) {
                Log.w(TAG, "sendReply", error);
                post(callback, false, error.getMessage());
            }
        }, "fiaram-bubble-reply").start();
    }

    static void markDirectRead(Context context, String peerId, Callback callback) {
        final String userId = BubbleSession.userId(context);
        if (userId.isEmpty() || peerId == null || peerId.isEmpty() || !BubbleSession.isReady(context)) {
            post(callback, false, "session incomplete");
            return;
        }
        new Thread(() -> {
            try {
                Row row = fetchRow(context, MESSAGES_KEY);
                JSONArray messages = row.exists ? asArray(row.value) : new JSONArray();
                boolean changed = false;
                for (int i = 0; i < messages.length(); i++) {
                    JSONObject message = messages.optJSONObject(i);
                    if (message == null) continue;
                    if (!peerId.equals(message.optString("sender_id"))) continue;
                    if (!userId.equals(message.optString("receiver_id"))) continue;
                    if ("read".equals(message.optString("status"))) continue;
                    message.put("status", "read");
                    changed = true;
                }
                if (changed) saveValue(context, MESSAGES_KEY, messages);
                post(callback, true, null);
            } catch (Exception error) {
                Log.w(TAG, "markDirectRead", error);
                post(callback, false, error.getMessage());
            }
        }, "fiaram-bubble-read").start();
    }

    static void markGroupRead(Context context, String groupId, Callback callback) {
        final String userId = BubbleSession.userId(context);
        if (userId.isEmpty() || groupId == null || groupId.isEmpty() || !BubbleSession.isReady(context)) {
            post(callback, false, "session incomplete");
            return;
        }
        new Thread(() -> {
            try {
                Row messageRow = fetchRow(context, MESSAGES_KEY);
                JSONArray messages = messageRow.exists ? asArray(messageRow.value) : new JSONArray();
                boolean changed = false;
                for (int i = 0; i < messages.length(); i++) {
                    JSONObject message = messages.optJSONObject(i);
                    if (message == null) continue;
                    if (!groupId.equals(message.optString("group_id"))) continue;
                    if (userId.equals(message.optString("sender_id"))) continue;
                    if (message.optBoolean("is_deleted")) continue;
                    JSONArray readBy = message.optJSONArray("read_by");
                    if (readBy == null) readBy = new JSONArray();
                    boolean found = false;
                    for (int j = 0; j < readBy.length(); j++) {
                        if (userId.equals(readBy.optString(j))) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        readBy.put(userId);
                        message.put("read_by", readBy);
                        changed = true;
                    }
                }
                if (changed) saveValue(context, MESSAGES_KEY, messages);

                Row readsRow = fetchRow(context, GROUP_READS_KEY);
                JSONObject reads = readsRow.exists ? asObject(readsRow.value) : new JSONObject();
                reads.put(userId + ":" + groupId, nowCursor());
                saveValue(context, GROUP_READS_KEY, reads);

                post(callback, true, null);
            } catch (Exception error) {
                Log.w(TAG, "markGroupRead", error);
                post(callback, false, error.getMessage());
            }
        }, "fiaram-bubble-group-read").start();
    }

    static void heartbeatPresence(Context context, Callback callback) {
        final String userId = BubbleSession.userId(context);
        if (userId.isEmpty() || !BubbleSession.isReady(context)) {
            post(callback, false, "session incomplete");
            return;
        }
        new Thread(() -> {
            try {
                Row row = fetchRow(context, PRESENCE_KEY);
                JSONObject presence = row.exists ? asObject(row.value) : new JSONObject();
                presence.put(userId, System.currentTimeMillis());
                saveValue(context, PRESENCE_KEY, presence);
                post(callback, true, null);
            } catch (Exception error) {
                Log.w(TAG, "heartbeatPresence", error);
                post(callback, false, error.getMessage());
            }
        }, "fiaram-bubble-presence").start();
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

    static String nowCursor() {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US);
        return format.format(new Date());
    }

    static String nowMinute() {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US);
        return format.format(new Date());
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
                + "?key=eq." + URLEncoder.encode(key, "UTF-8")
                + "&select=value,updated_at";
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
        String base = baseUrl.replaceAll("/+$", "") + "/rest/v1/" + TABLE;
        JSONObject body = new JSONObject();
        body.put("key", key);
        body.put("value", value);
        body.put("updated_at", nowIso());
        write(base, apiKey, "POST", body.toString(),
                "resolution=merge-duplicates,return=minimal");
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
        write(url, apiKey, method, body, "return=minimal");
    }

    private static void write(String url, String apiKey, String method, String body, String prefer) throws Exception {
        HttpURLConnection connection = open(url, apiKey, method);
        connection.setDoOutput(true);
        connection.setRequestProperty("Prefer", prefer);
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
