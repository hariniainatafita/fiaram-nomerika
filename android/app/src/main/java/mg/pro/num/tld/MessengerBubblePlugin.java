package mg.pro.num.tld;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.firebase.messaging.FirebaseMessaging;

@CapacitorPlugin(
        name = "MessengerBubble",
        permissions = {
                @Permission(
                        alias = "notifications",
                        strings = {Manifest.permission.POST_NOTIFICATIONS}
                )
        }
)
public class MessengerBubblePlugin extends Plugin {

    @PluginMethod
    public void getBubblePermissions(PluginCall call) {
        JSObject result = new JSObject();
        result.put("overlay", Settings.canDrawOverlays(getContext()));
        result.put("notifications", notificationsGranted());
        call.resolve(result);
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        JSObject result = new JSObject();
        if (Settings.canDrawOverlays(getContext())) {
            result.put("requested", false);
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        try {
            Intent intent = new Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getContext().getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            result.put("requested", true);
            result.put("granted", false);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Impossible d'ouvrir les autorisations d'affichage", error);
        }
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || notificationsGranted()) {
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", notificationsGranted());
        call.resolve(result);
    }

    @PluginMethod
    public void startBackgroundWatcher(PluginCall call) {
        saveSession(call);
        if (!BubbleSession.isReady(getContext())) {
            call.reject("Session incomplète");
            return;
        }
        BubbleSession.setWatchEnabled(getContext(), true);
        BubbleService.start(getContext());
        JSObject result = new JSObject();
        result.put("started", true);
        call.resolve(result);
    }

    @PluginMethod
    public void stopBackgroundWatcher(PluginCall call) {
        BubbleSession.setWatchEnabled(getContext(), false);
        BubbleSession.clearSession(getContext());
        BubbleService.stop(getContext());
        call.resolve();
    }

    @PluginMethod
    public void startBubble(PluginCall call) {
        saveSession(call);
        if (!BubbleSession.isReady(getContext())) {
            call.reject("Session incomplète");
            return;
        }
        BubbleSession.setWatchEnabled(getContext(), true);
        BubbleSession.setBubbleEnabled(getContext(), true);
        BubbleSession.setOverlayHidden(getContext(), false);
        boolean overlay = Settings.canDrawOverlays(getContext());
        BubbleService.start(getContext());
        JSObject result = new JSObject();
        result.put("started", true);
        result.put("needsOverlayPermission", !overlay);
        call.resolve(result);
    }

    @PluginMethod
    public void stopBubble(PluginCall call) {
        BubbleSession.setBubbleEnabled(getContext(), false);
        BubbleSession.setOverlayHidden(getContext(), true);
        if (BubbleSession.isWatchEnabled(getContext())) {
            BubbleService.hideBubbleOverlay(getContext());
        } else {
            BubbleService.stop(getContext());
        }
        call.resolve();
    }

    @PluginMethod
    public void showMessage(PluginCall call) {
        if (!BubbleSession.isWatchEnabled(getContext())) {
            call.resolve();
            return;
        }
        BubbleService.showMessage(
                getContext(),
                call.getString("messageId", ""),
                call.getString("peerId", ""),
                call.getString("groupId", ""),
                call.getString("senderId", ""),
                call.getString("senderName", ""),
                call.getString("text", "")
        );
        call.resolve();
    }

    @PluginMethod
    public void showIncomingCall(PluginCall call) {
        if (!BubbleSession.isWatchEnabled(getContext())) {
            call.resolve();
            return;
        }
        BubbleService.showIncomingCall(
                getContext(),
                call.getString("peerId", ""),
                call.getString("peerName", ""),
                call.getString("peerPhoto", ""),
                call.getString("callType", "voice")
        );
        call.resolve();
    }

    @PluginMethod
    public void hideIncomingCall(PluginCall call) {
        BubbleService.hideIncomingCall(getContext());
        MessageNotifier.cancelIncomingCall(getContext());
        call.resolve();
    }

    @PluginMethod
    public void clearMessages(PluginCall call) {
        BubbleService.clearUnread(getContext());
        call.resolve();
    }

    @PluginMethod
    public void consumePendingChat(PluginCall call) {
        JSObject result = new JSObject();
        String[] pending = BubbleSession.consumePendingChat(getContext());
        if (pending != null) {
            result.put("type", pending[0]);
            result.put("id", pending[1]);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void refreshBubble(PluginCall call) {
        BubbleService.refresh(getContext());
        call.resolve();
    }

    @PluginMethod
    public void registerPushToken(PluginCall call) {
        saveSession(call);
        String userId = BubbleSession.userId(getContext());
        if (userId.isEmpty() || !BubbleSession.isReady(getContext())) {
            call.reject("Session incomplète");
            return;
        }
        try {
            FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                JSObject result = new JSObject();
                if (!task.isSuccessful() || task.getResult() == null) {
                    result.put("registered", false);
                    call.resolve(result);
                    return;
                }
                SupabaseRest.registerDeviceToken(getContext(), userId, task.getResult(), (success, error) -> {
                    result.put("registered", success);
                    call.resolve(result);
                });
            });
        } catch (Throwable error) {
            JSObject result = new JSObject();
            result.put("registered", false);
            call.resolve(result);
        }
    }

    private void saveSession(PluginCall call) {
        BubbleSession.save(
                getContext(),
                call.getString("userId", ""),
                call.getString("userName", ""),
                call.getString("photoUrl", ""),
                call.getString("supabaseUrl", ""),
                call.getString("supabaseAnonKey", ""),
                call.getString("role", ""),
                call.getString("groupeId", "")
        );
    }

    private boolean notificationsGranted() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true;
        return ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED;
    }
}
