package mg.fiaram.nomerika;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Session partagee entre le pont web Capacitor, le service de bulle et le
 * service de notifications Firebase. Elle contient uniquement les identifiants
 * necessaires a l'envoi rapide d'une reponse.
 */
final class BubbleSession {
    private static final String PREFS = "fiaram_messenger_bubble";
    private static final String KEY_USER_ID = "user_id";
    private static final String KEY_USER_NAME = "user_name";
    private static final String KEY_PHOTO_URL = "photo_url";
    private static final String KEY_SUPABASE_URL = "supabase_url";
    private static final String KEY_SUPABASE_KEY = "supabase_key";

    private BubbleSession() {
    }

    static void save(Context context, String userId, String userName, String photoUrl,
                     String supabaseUrl, String supabaseAnonKey) {
        SharedPreferences.Editor editor = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        editor.putString(KEY_USER_ID, userId);
        editor.putString(KEY_USER_NAME, userName);
        editor.putString(KEY_PHOTO_URL, photoUrl);
        editor.putString(KEY_SUPABASE_URL, supabaseUrl);
        editor.putString(KEY_SUPABASE_KEY, supabaseAnonKey);
        editor.apply();
    }

    static String userId(Context context) {
        return prefs(context).getString(KEY_USER_ID, "");
    }

    static String userName(Context context) {
        return prefs(context).getString(KEY_USER_NAME, "");
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

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
