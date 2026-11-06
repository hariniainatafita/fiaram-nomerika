package mg.fiaram.nomerika;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Session partagee entre le pont web Capacitor, le service de bulle et le
 * service de notifications. Elle contient les identifiants necessaires a la
 * lecture des messages et a l'envoi rapide d'une reponse.
 */
final class BubbleSession {
    private static final String PREFS = "fiaram_messenger_bubble";

    private static final String KEY_USER_ID = "user_id";
    private static final String KEY_USER_NAME = "user_name";
    private static final String KEY_USER_ROLE = "user_role";
    private static final String KEY_USER_GROUP = "user_group";
    private static final String KEY_PHOTO_URL = "photo_url";
    private static final String KEY_SUPABASE_URL = "supabase_url";
    private static final String KEY_SUPABASE_KEY = "supabase_key";

    private static final String KEY_BUBBLE_ENABLED = "bubble_enabled";
    private static final String KEY_APP_FOREGROUND = "app_foreground";
    private static final String KEY_PENDING_CHAT_TYPE = "pending_chat_type";
    private static final String KEY_PENDING_CHAT_ID = "pending_chat_id";
    private static final String KEY_KNOWN_IDS = "known_message_ids";
    private static final String KEY_LAST_MESSAGES_UPDATED = "last_messages_updated";
    private static final String KEY_LAST_POLL_AT = "last_poll_at";

    private BubbleSession() {
    }

    static void save(Context context, String userId, String userName, String photoUrl,
                     String supabaseUrl, String supabaseAnonKey) {
        save(context, userId, userName, photoUrl, supabaseUrl, supabaseAnonKey, "", "");
    }

    static void save(Context context, String userId, String userName, String photoUrl,
                     String supabaseUrl, String supabaseAnonKey, String role, String groupeId) {
        SharedPreferences.Editor editor = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        editor.putString(KEY_USER_ID, safe(userId));
        editor.putString(KEY_USER_NAME, safe(userName));
        editor.putString(KEY_USER_ROLE, safe(role));
        editor.putString(KEY_USER_GROUP, safe(groupeId));
        editor.putString(KEY_PHOTO_URL, safe(photoUrl));
        editor.putString(KEY_SUPABASE_URL, safe(supabaseUrl));
        editor.putString(KEY_SUPABASE_KEY, safe(supabaseAnonKey));
        editor.apply();
    }

    static String userId(Context context) {
        return prefs(context).getString(KEY_USER_ID, "");
    }

    static String userName(Context context) {
        return prefs(context).getString(KEY_USER_NAME, "");
    }

    static String userRole(Context context) {
        return prefs(context).getString(KEY_USER_ROLE, "");
    }

    static String userGroup(Context context) {
        return prefs(context).getString(KEY_USER_GROUP, "");
    }

    static String photoUrl(Context context) {
        return prefs(context).getString(KEY_PHOTO_URL, "");
    }

    static String supabaseUrl(Context context) {
        return prefs(context).getString(KEY_SUPABASE_URL, "");
    }

    static String supabaseKey(Context context) {
        return prefs(context).getString(KEY_SUPABASE_KEY, "");
    }

    static boolean isReady(Context context) {
        return !userId(context).isEmpty()
                && !supabaseUrl(context).isEmpty()
                && !supabaseKey(context).isEmpty();
    }

    static void setBubbleEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_BUBBLE_ENABLED, enabled).apply();
    }

    static boolean isBubbleEnabled(Context context) {
        return prefs(context).getBoolean(KEY_BUBBLE_ENABLED, false);
    }

    static void setAppForeground(Context context, boolean foreground) {
        prefs(context).edit().putBoolean(KEY_APP_FOREGROUND, foreground).apply();
    }

    static boolean isAppForeground(Context context) {
        return prefs(context).getBoolean(KEY_APP_FOREGROUND, false);
    }

    static void setPendingChat(Context context, String type, String id) {
        if (type == null || id == null || id.isEmpty()) return;
        prefs(context).edit()
                .putString(KEY_PENDING_CHAT_TYPE, type)
                .putString(KEY_PENDING_CHAT_ID, id)
                .commit();
    }

    /** Returns {type, id} once, then clears the pending chat. */
    static String[] consumePendingChat(Context context) {
        SharedPreferences prefs = prefs(context);
        String type = prefs.getString(KEY_PENDING_CHAT_TYPE, "");
        String id = prefs.getString(KEY_PENDING_CHAT_ID, "");
        if (type.isEmpty() || id.isEmpty()) return null;
        prefs.edit()
                .remove(KEY_PENDING_CHAT_TYPE)
                .remove(KEY_PENDING_CHAT_ID)
                .apply();
        return new String[]{type, id};
    }

    static Set<String> knownMessageIds(Context context) {
        Set<String> ids = new LinkedHashSet<>();
        try {
            JSONArray array = new JSONArray(prefs(context).getString(KEY_KNOWN_IDS, "[]"));
            for (int i = 0; i < array.length(); i++) {
                String id = array.optString(i, "");
                if (!id.isEmpty()) ids.add(id);
            }
        } catch (Exception ignored) {
            /* donnees illisibles : on repart d'une base vide */
        }
        return ids;
    }

    static void setKnownMessageIds(Context context, Set<String> ids) {
        JSONArray array = new JSONArray();
        int skip = Math.max(0, ids.size() - 800);
        int index = 0;
        for (String id : ids) {
            if (index++ < skip) continue;
            array.put(id);
        }
        prefs(context).edit().putString(KEY_KNOWN_IDS, array.toString()).apply();
    }

    static String lastMessagesUpdated(Context context) {
        return prefs(context).getString(KEY_LAST_MESSAGES_UPDATED, "");
    }

    static void setLastMessagesUpdated(Context context, String value) {
        prefs(context).edit().putString(KEY_LAST_MESSAGES_UPDATED, safe(value)).apply();
    }

    static long lastPollAt(Context context) {
        return prefs(context).getLong(KEY_LAST_POLL_AT, 0L);
    }

    static void setLastPollAt(Context context, long value) {
        prefs(context).edit().putLong(KEY_LAST_POLL_AT, value).apply();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }
}
