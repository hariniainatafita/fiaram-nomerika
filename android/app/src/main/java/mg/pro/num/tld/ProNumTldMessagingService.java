package mg.pro.num.tld;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Recoit les notifications push quand l'application est fermee ou en
 * arriere-plan, met a jour la bulle et affiche une notification systeme.
 * Le service de veille (BubbleService) reste la source principale quand
 * Firebase n'est pas configure.
 */
public class ProNumTldMessagingService extends FirebaseMessagingService {

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

        if (BubbleSession.isWatchEnabled(this)) {
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

        if (BubbleSession.isAppForeground(this)) return;
        String chatType = groupId.isEmpty() ? "direct" : "group";
        String chatId = groupId.isEmpty() ? peerId : groupId;
        MessageNotifier.showMessage(this, chatType, chatId, senderName, "", text, messageId);
    }

    private static String value(Map<String, String> data, String key) {
        String result = data.get(key);
        return result == null ? "" : result;
    }
}
