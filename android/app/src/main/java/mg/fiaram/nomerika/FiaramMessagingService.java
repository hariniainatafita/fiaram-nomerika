package mg.fiaram.nomerika;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Recoit les notifications push quand l'application est fermee ou en
 * arriere-plan, met a jour la bulle et affiche une notification systeme.
 */
public class FiaramMessagingService extends FirebaseMessagingService {
    private static final String CHANNEL_ID = "fiaram_messages";
    private static final int NOTIFICATION_ID = 7302;

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        if (!BubbleSession.isReady(this)) return;
        SupabaseRest.registerDeviceToken(this, BubbleSession.userId(this), token, null);
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        super.onMessageReceived(message);
        Map<String, String> data = message.getData();
        String type = value(data, "type");
        if (!type.isEmpty() && !"message".equals(type)) return;

        String senderId = value(data, "senderId");
        String senderName = value(data, "senderName");
        String text = value(data, "text");
        String peerId = value(data, "peerId");
        String groupId = value(data, "groupId");
        String messageId = value(data, "messageId");
        if (text.isEmpty() && senderName.isEmpty()) return;

        if (Settings.canDrawOverlays(this)) {
            BubbleService.showMessage(
                    this,
                    messageId,
                    peerId,
                    groupId,
                    senderId,
                    senderName,
                    text
            );
        }
        showNotification(senderName, text);
    }

    private void showNotification(String senderName, String text) {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        createChannel(manager);

        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT
                        | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_fiaram)
                .setContentTitle(senderName.isEmpty() ? "Nouveau message" : senderName)
                .setContentText(text)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setDefaults(NotificationCompat.DEFAULT_ALL);

        manager.notify(NOTIFICATION_ID, builder.build());
    }

    private void createChannel(NotificationManager manager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Messages FIARAM",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Notifications des nouveaux messages");
        manager.createNotificationChannel(channel);
    }

    private static String value(Map<String, String> data, String key) {
        String result = data.get(key);
        return result == null ? "" : result;
    }
}
