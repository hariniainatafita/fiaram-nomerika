package mg.fiaram.nomerika;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

/**
 * Notifications systeme du Messenger. Le service de veille et l'ancien service
 * Firebase passent tous les deux par ici pour garder un seul style et un seul
 * jeu de canaux.
 */
final class MessageNotifier {
    static final String CHANNEL_MESSAGES = "fiaram_messages";
    static final String CHANNEL_SERVICE = "fiaram_messenger_bubble";

    static final String EXTRA_CHAT_TYPE = "chat_type";
    static final String EXTRA_CHAT_ID = "chat_id";
    static final String EXTRA_MESSAGE_ID = "message_id";

    private static final int SERVICE_NOTIFICATION_ID = 7301;
    private static final int MESSAGE_BASE_ID = 8100;
    private static final String GROUP_KEY = "fiaram_messages_group";

    private MessageNotifier() {
    }

    static void ensureChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        NotificationChannel messages = new NotificationChannel(
                CHANNEL_MESSAGES,
                "Messages FIARAM",
                NotificationManager.IMPORTANCE_HIGH
        );
        messages.setDescription("Notifications des nouveaux messages");
        messages.enableVibration(true);
        manager.createNotificationChannel(messages);

        NotificationChannel service = new NotificationChannel(
                CHANNEL_SERVICE,
                "Messenger FIARAM",
                NotificationManager.IMPORTANCE_LOW
        );
        service.setDescription("Maintient les bulles et la presence en ligne");
        service.setShowBadge(false);
        manager.createNotificationChannel(service);
    }

    static Notification serviceNotification(Context context, String text) {
        ensureChannels(context);
        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                0,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT
                        | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );
        return new NotificationCompat.Builder(context, CHANNEL_SERVICE)
                .setSmallIcon(R.drawable.ic_stat_fiaram)
                .setContentTitle("FIARAM NUMERIQUE")
                .setContentText(text)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    static void showMessage(Context context, String chatType, String chatId,
                            String senderName, String groupName, String text,
                            String messageId) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        ensureChannels(context);

        String title = groupName == null || groupName.isEmpty() ? senderName : groupName;
        String body = groupName == null || groupName.isEmpty()
                ? text
                : (senderName.isEmpty() ? text : senderName + " : " + text);

        int id = chatNotificationId(chatType, chatId);
        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        openIntent.putExtra(EXTRA_CHAT_TYPE, chatType);
        openIntent.putExtra(EXTRA_CHAT_ID, chatId);
        openIntent.putExtra(EXTRA_MESSAGE_ID, messageId == null ? "" : messageId);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                id,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT
                        | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_MESSAGES)
                .setSmallIcon(R.drawable.ic_stat_fiaram)
                .setContentTitle(title == null || title.isEmpty() ? "Nouveau message" : title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setGroup(GROUP_KEY)
                .setDefaults(NotificationCompat.DEFAULT_ALL);

        manager.notify(id, builder.build());
    }

    static void cancelChat(Context context, String chatType, String chatId) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        manager.cancel(chatNotificationId(chatType, chatId));
    }

    static int serviceNotificationId() {
        return SERVICE_NOTIFICATION_ID;
    }

    static int chatNotificationId(String chatType, String chatId) {
        String key = (chatType == null ? "" : chatType) + ":" + (chatId == null ? "" : chatId);
        int hash = key.hashCode() & 0x7fffffff;
        return MESSAGE_BASE_ID + (hash % 1000);
    }
}
