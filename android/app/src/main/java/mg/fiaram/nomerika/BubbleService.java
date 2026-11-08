package mg.fiaram.nomerika;

import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class BubbleService extends Service {
    private static final String PREFS = "fiaram_bubble_position";

    static final String ACTION_START = "mg.fiaram.nomerika.BUBBLE_START";
    static final String ACTION_SHOW = "mg.fiaram.nomerika.BUBBLE_SHOW";
    static final String ACTION_CLEAR = "mg.fiaram.nomerika.BUBBLE_CLEAR";
    static final String ACTION_REFRESH = "mg.fiaram.nomerika.BUBBLE_REFRESH";
    static final String ACTION_PICK_BUBBLE_PHOTO = "mg.fiaram.nomerika.PICK_BUBBLE_PHOTO";
    static final String ACTION_SEND_BUBBLE_PHOTO = "mg.fiaram.nomerika.SEND_BUBBLE_PHOTO";
    static final String ACTION_SHOW_CALL = "mg.fiaram.nomerika.BUBBLE_SHOW_CALL";
    static final String ACTION_HIDE_CALL = "mg.fiaram.nomerika.BUBBLE_HIDE_CALL";
    static final String ACTION_HIDE_BUBBLE = "mg.fiaram.nomerika.BUBBLE_HIDE_BUBBLE";

    private static final String EXTRA_MESSAGE_ID = "message_id";
    private static final String EXTRA_PEER_ID = "peer_id";
    private static final String EXTRA_GROUP_ID = "group_id";
    private static final String EXTRA_SENDER_ID = "sender_id";
    private static final String EXTRA_SENDER_NAME = "sender_name";
    private static final String EXTRA_TEXT = "text";
    private static final String EXTRA_DATA_URL = "data_url";
    private static final String EXTRA_PEER_PHOTO = "peer_photo";
    private static final String EXTRA_CALL_TYPE = "call_type";

    private static final long POLL_INTERVAL_MS = 30_000L;
    private static final int MAX_HEADS = 5;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private ExecutorService executor;

    private WindowManager windowManager;
    private WindowManager.LayoutParams windowParams;
    private LinearLayout root;
    private LinearLayout stackView;
    private LinearLayout panel;
    private View deleteTarget;
    private WindowManager.LayoutParams deleteTargetParams;
    private boolean deleteTargetVisible;
    private TextView panelTitle;
    private TextView panelSubtitle;
    private LinearLayout messagesContainer;
    private ScrollView messagesScroll;
    private EditText replyInput;
    private TextView sendButton;

    private final List<ChatHead> chats = new ArrayList<>();
    private JSONArray cachedMessages = new JSONArray();
    private JSONObject cachedMembers = new JSONObject();
    private JSONObject cachedGroups = new JSONObject();
    private JSONObject cachedReads = new JSONObject();
    private Set<String> knownIds = new LinkedHashSet<>();

    private String selectedType = "";
    private String selectedId = "";
    private boolean expanded;
    private boolean headsOpen;
    private View headsBackdrop;
    private WindowManager.LayoutParams headsBackdropParams;
    private IncomingCallState incomingCall;
    private boolean dragging;
    private boolean pollInFlight;
    private volatile boolean firstPollDone;
    private float downRawX;
    private float downRawY;
    private int touchStartX;
    private int touchStartY;
    private int panelHeightPx;

    private final Runnable pollRunnable = this::pollOnce;

    static void start(Context context) {
        Intent intent = new Intent(context, BubbleService.class);
        intent.setAction(ACTION_START);
        startSafely(context, intent);
    }

    static void showMessage(Context context, String messageId, String peerId, String groupId,
                            String senderId, String senderName, String text) {
        Intent intent = new Intent(context, BubbleService.class);
        intent.setAction(ACTION_SHOW);
        intent.putExtra(EXTRA_MESSAGE_ID, messageId);
        intent.putExtra(EXTRA_PEER_ID, peerId);
        intent.putExtra(EXTRA_GROUP_ID, groupId);
        intent.putExtra(EXTRA_SENDER_ID, senderId);
        intent.putExtra(EXTRA_SENDER_NAME, senderName);
        intent.putExtra(EXTRA_TEXT, text);
        startSafely(context, intent);
    }

    static void clearUnread(Context context) {
        Intent intent = new Intent(context, BubbleService.class);
        intent.setAction(ACTION_CLEAR);
        startSafely(context, intent);
    }

    static void refresh(Context context) {
        Intent intent = new Intent(context, BubbleService.class);
        intent.setAction(ACTION_REFRESH);
        startSafely(context, intent);
    }

    static void hideBubbleOverlay(Context context) {
        Intent intent = new Intent(context, BubbleService.class);
        intent.setAction(ACTION_HIDE_BUBBLE);
        startSafely(context, intent);
    }

    static void stop(Context context) {
        context.stopService(new Intent(context, BubbleService.class));
    }

    static void sendPhotoResult(Context context, String dataUrl) {
        if (dataUrl == null || dataUrl.isEmpty()) return;
        Intent intent = new Intent(context, BubbleService.class);
        intent.setAction(ACTION_SEND_BUBBLE_PHOTO);
        intent.putExtra(EXTRA_DATA_URL, dataUrl);
        startSafely(context, intent);
    }

    static void showIncomingCall(Context context, String peerId, String peerName, String peerPhoto, String callType) {
        if (peerId == null || peerId.isEmpty()) return;
        Intent intent = new Intent(context, BubbleService.class);
        intent.setAction(ACTION_SHOW_CALL);
        intent.putExtra(EXTRA_PEER_ID, peerId);
        intent.putExtra(EXTRA_SENDER_NAME, peerName == null ? "" : peerName);
        intent.putExtra(EXTRA_PEER_PHOTO, peerPhoto == null ? "" : peerPhoto);
        intent.putExtra(EXTRA_CALL_TYPE, callType == null ? "voice" : callType);
        startSafely(context, intent);
    }

    static void hideIncomingCall(Context context) {
        Intent intent = new Intent(context, BubbleService.class);
        intent.setAction(ACTION_HIDE_CALL);
        startSafely(context, intent);
    }

    private static void startSafely(Context context, Intent intent) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(context, intent);
            } else {
                context.startService(intent);
            }
        } catch (Exception ignored) {
            /* Android peut refuser un demarrage depuis l'arriere-plan */
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        MessageNotifier.ensureChannels(this);
        startForeground(MessageNotifier.serviceNotificationId(),
                MessageNotifier.serviceNotification(this, "Connexion au Messenger..."));
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        executor = Executors.newSingleThreadExecutor();
        knownIds = BubbleSession.knownMessageIds(this);
        panelHeightPx = Math.min(dp(440), getResources().getDisplayMetrics().heightPixels - dp(110));
        if (Settings.canDrawOverlays(this) && !BubbleSession.isOverlayHidden(this)) showOverlay();
        mainHandler.postDelayed(pollRunnable, 1200);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : ACTION_START;
        if (ACTION_SHOW.equals(action) && intent != null) {
            if (!BubbleSession.isWatchEnabled(this)) {
                stopSelf(startId);
                return START_NOT_STICKY;
            }
            handlePushedMessage(intent);
            pollOnce();
        } else if (ACTION_SEND_BUBBLE_PHOTO.equals(action) && intent != null) {
            if (!BubbleSession.isWatchEnabled(this)) {
                stopSelf(startId);
                return START_NOT_STICKY;
            }
            String dataUrl = safe(intent.getStringExtra(EXTRA_DATA_URL));
            if (!dataUrl.isEmpty()) sendPhotoFromBubble(dataUrl);
        } else if (ACTION_SHOW_CALL.equals(action) && intent != null) {
            if (!BubbleSession.isWatchEnabled(this)) {
                stopSelf(startId);
                return START_NOT_STICKY;
            }
            String peerId = safe(intent.getStringExtra(EXTRA_PEER_ID));
            if (!peerId.isEmpty()) {
                incomingCall = new IncomingCallState(
                        peerId,
                        safe(intent.getStringExtra(EXTRA_SENDER_NAME)),
                        safe(intent.getStringExtra(EXTRA_PEER_PHOTO)),
                        safe(intent.getStringExtra(EXTRA_CALL_TYPE))
                );
                if (root == null && BubbleSession.isBubbleEnabled(this)
                        && Settings.canDrawOverlays(this)) showOverlay();
                MessageNotifier.showIncomingCall(this, peerId, incomingCall.peerName, incomingCall.callType);
                renderStack();
            }
        } else if (ACTION_HIDE_CALL.equals(action)) {
            incomingCall = null;
            MessageNotifier.cancelIncomingCall(this);
            renderStack();
            if (!BubbleSession.isWatchEnabled(this)) stopSelf(startId);
        } else if (ACTION_CLEAR.equals(action)) {
            cancelAllChatNotifications();
            if (!BubbleSession.isWatchEnabled(this)) stopSelf(startId);
        } else if (ACTION_HIDE_BUBBLE.equals(action)) {
            removeOverlay();
            if (!BubbleSession.isWatchEnabled(this)) stopSelf(startId);
        } else if (ACTION_REFRESH.equals(action)) {
            if (BubbleSession.isWatchEnabled(this)) {
                pollOnce();
            } else {
                stopSelf(startId);
            }
        } else {
            if (!BubbleSession.isWatchEnabled(this)) {
                stopSelf(startId);
                return START_NOT_STICKY;
            }
            if (root == null && Settings.canDrawOverlays(this)) showOverlay();
            pollOnce();
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        mainHandler.removeCallbacksAndMessages(null);
        if (executor != null) executor.shutdownNow();
        removeOverlay();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void handlePushedMessage(Intent intent) {
        String peerId = safe(intent.getStringExtra(EXTRA_PEER_ID));
        String groupId = safe(intent.getStringExtra(EXTRA_GROUP_ID));
        String senderName = safe(intent.getStringExtra(EXTRA_SENDER_NAME));
        String text = safe(intent.getStringExtra(EXTRA_TEXT));
        String key = !groupId.isEmpty() ? "group:" + groupId : "direct:" + peerId;
        if (key.equals("direct:")) return;

        ChatHead chat = null;
        for (ChatHead item : chats) {
            if ((item.type + ":" + item.id).equals(key)) {
                chat = item;
                break;
            }
        }
        if (chat == null) {
            chat = new ChatHead();
            chat.type = groupId.isEmpty() ? "direct" : "group";
            chat.id = groupId.isEmpty() ? peerId : groupId;
            chat.name = senderName;
            chats.add(0, chat);
        }
        chat.lastText = text;
        chat.lastSender = senderName;
        chat.lastAt = SupabaseRest.nowMinute();
        if (!BubbleSession.isAppForeground(this)
                && (!chat.type.equals(selectedType) || !chat.id.equals(selectedId))) {
            chat.unread += 1;
            restoreBubbleAfterMessage();
        }
        renderStack();
    }

    private void restoreBubbleAfterMessage() {
        if (!BubbleSession.isBubbleEnabled(this)
                || !Settings.canDrawOverlays(this)) return;
        if (BubbleSession.isOverlayHidden(this)) {
            BubbleSession.setOverlayHidden(this, false);
            showOverlay();
        } else if (root == null) {
            showOverlay();
        }
        renderStack();
    }

    private void pollOnce() {
        if (pollInFlight) return;
        if (!BubbleSession.isReady(this)) {
            stopSelf();
            return;
        }
        pollInFlight = true;
        final Context app = getApplicationContext();
        executor.execute(() -> {
            try {
                SupabaseRest.Row row = SupabaseRest.fetchRow(app, SupabaseRest.MESSAGES_KEY);
                boolean changed = !firstPollDone
                        || !row.updatedAt.equals(BubbleSession.lastMessagesUpdated(app));
                SupabaseRest.heartbeatPresence(app, null);
                if (!changed) return;

                JSONArray messages = SupabaseRest.asArray(row.value);
                JSONObject members = indexById(SupabaseRest.asArray(
                        SupabaseRest.fetchRow(app, SupabaseRest.MEMBERS_KEY).value));
                JSONObject groups = indexById(SupabaseRest.asArray(
                        SupabaseRest.fetchRow(app, SupabaseRest.GROUPS_KEY).value));
                JSONObject reads = SupabaseRest.asObject(
                        SupabaseRest.fetchRow(app, SupabaseRest.GROUP_READS_KEY).value);
                String updatedAt = row.updatedAt;

                mainHandler.post(() -> applyData(messages, members, groups, reads, updatedAt));
            } catch (Exception error) {
                mainHandler.post(() -> updateServiceNotification("Hors ligne, nouvelle tentative..."));
            } finally {
                mainHandler.post(() -> {
                    pollInFlight = false;
                    mainHandler.removeCallbacks(pollRunnable);
                    if (BubbleSession.isWatchEnabled(app)) {
                        mainHandler.postDelayed(pollRunnable, POLL_INTERVAL_MS);
                    }
                });
            }
        });
    }

    private void applyData(JSONArray messages, JSONObject members, JSONObject groups,
                           JSONObject reads, String updatedAt) {
        cachedMessages = messages != null ? messages : cachedMessages;
        if (members != null) cachedMembers = members;
        if (groups != null) cachedGroups = groups;
        if (reads != null) cachedReads = reads;
        BubbleSession.setLastMessagesUpdated(this, updatedAt);

        String me = BubbleSession.userId(this);
        Set<String> visibleGroups = visibleGroupIds(cachedGroups);
        boolean baseline = knownIds.isEmpty();
        List<JSONObject> incoming = new ArrayList<>();

        for (int i = 0; i < cachedMessages.length(); i++) {
            JSONObject message = cachedMessages.optJSONObject(i);
            if (message == null) continue;
            String id = message.optString("id", "");
            if (id.isEmpty()) continue;
            boolean isNew = !knownIds.contains(id);
            if (isNew) {
                knownIds.add(id);
                String key = chatKeyFor(message, me, visibleGroups);
                if (!baseline && key != null && !me.equals(message.optString("sender_id"))) {
                    incoming.add(message);
                }
            }
        }
        BubbleSession.setKnownMessageIds(this, knownIds);

        List<ChatHead> next = buildChats(cachedMessages, cachedMembers, cachedGroups, cachedReads);
        chats.clear();
        chats.addAll(next);

        if (!incoming.isEmpty() && !BubbleSession.isAppForeground(this)) {
            for (JSONObject message : incoming) notifyForMessage(message, me, visibleGroups);
            restoreBubbleAfterMessage();
        }

        firstPollDone = true;
        renderStack();
        if (expanded) renderConversation(true);
        updateServiceNotification(chats.isEmpty()
                ? "FIARAM actif en arriere-plan"
                : chats.size() + " discussion(s) recente(s)");
    }

    private void notifyForMessage(JSONObject message, String me, Set<String> visibleGroups) {
        String key = chatKeyFor(message, me, visibleGroups);
        if (key == null) return;
        String groupId = message.optString("group_id", "");
        String chatType = groupId.isEmpty() ? "direct" : "group";
        String chatId = groupId.isEmpty() ? message.optString("sender_id", "") : groupId;
        String senderId = message.optString("sender_id", "");
        String senderName = memberName(cachedMembers.optJSONObject(senderId));
        String groupName = "";
        if (!groupId.isEmpty()) {
            JSONObject group = cachedGroups.optJSONObject(groupId);
            groupName = group != null ? group.optString("nom_groupe", "Groupe") : "Groupe";
        }
        MessageNotifier.showMessage(
                this,
                chatType,
                chatId,
                senderName,
                groupName,
                preview(message),
                message.optString("id", "")
        );
    }

    private List<ChatHead> buildChats(JSONArray messages, JSONObject members,
                                      JSONObject groups, JSONObject reads) {
        String me = BubbleSession.userId(this);
        Set<String> visibleGroups = visibleGroupIds(groups);
        Map<String, ChatHead> map = new LinkedHashMap<>();

        for (int i = 0; i < messages.length(); i++) {
            JSONObject message = messages.optJSONObject(i);
            if (message == null || message.optBoolean("is_deleted")) continue;
            String key = chatKeyFor(message, me, visibleGroups);
            if (key == null) continue;
            ChatHead chat = map.get(key);
            if (chat == null) {
                String[] parts = key.split(":", 2);
                chat = new ChatHead();
                chat.type = parts[0];
                chat.id = parts.length > 1 ? parts[1] : "";
                populateIdentity(chat, members, groups);
                map.put(key, chat);
            }
            String sentAt = message.optString("sent_at", "");
            if (chat.lastAt.isEmpty() || sentAt.compareTo(chat.lastAt) >= 0) {
                chat.lastAt = sentAt;
                chat.lastText = preview(message);
                chat.lastSender = me.equals(message.optString("sender_id"))
                        ? "Vous"
                        : memberName(members.optJSONObject(message.optString("sender_id")));
            }
        }

        for (ChatHead chat : map.values()) chat.unread = 0;

        for (int i = 0; i < messages.length(); i++) {
            JSONObject message = messages.optJSONObject(i);
            if (message == null || message.optBoolean("is_deleted")) continue;
            String key = chatKeyFor(message, me, visibleGroups);
            if (key == null) continue;
            ChatHead chat = map.get(key);
            if (chat == null) continue;
            if (me.equals(message.optString("sender_id"))) continue;
            String sentAt = message.optString("sent_at", "");
            if ("group".equals(chat.type)) {
                String cursor = reads.optString(me + ":" + chat.id, "");
                if (cursor.isEmpty() || sentAt.compareTo(cursor) > 0) chat.unread += 1;
            } else if (me.equals(message.optString("receiver_id"))
                    && !"read".equals(message.optString("status"))) {
                chat.unread += 1;
            }
        }

        List<ChatHead> list = new ArrayList<>(map.values());
        Collections.sort(list, (left, right) -> right.lastAt.compareTo(left.lastAt));
        return list;
    }

    private void populateIdentity(ChatHead chat, JSONObject members, JSONObject groups) {
        if ("group".equals(chat.type)) {
            JSONObject group = groups.optJSONObject(chat.id);
            chat.name = group != null ? group.optString("nom_groupe", "Groupe") : "Groupe";
            chat.avatarUrl = group != null ? group.optString("photo_url", "") : "";
            chat.avatarMemberId = "";
        } else {
            JSONObject member = members.optJSONObject(chat.id);
            chat.name = member != null ? memberName(member) : "Membre";
            chat.avatarUrl = member != null ? member.optString("photo_url", "") : "";
            chat.avatarMemberId = chat.id;
        }
    }

    private String chatKeyFor(JSONObject message, String me, Set<String> visibleGroups) {
        if (message.optBoolean("is_deleted")) return null;
        String groupId = message.optString("group_id", "");
        String senderId = message.optString("sender_id", "");
        String receiverId = message.optString("receiver_id", "");
        if (!groupId.isEmpty()) {
            return visibleGroups.contains(groupId) ? "group:" + groupId : null;
        }
        if (me.equals(senderId) && !receiverId.isEmpty()) return "direct:" + receiverId;
        if (me.equals(receiverId) && !senderId.isEmpty()) return "direct:" + senderId;
        return null;
    }

    private Set<String> visibleGroupIds(JSONObject groups) {
        Set<String> visible = new HashSet<>();
        String me = BubbleSession.userId(this);
        String role = BubbleSession.userRole(this);
        String myGroup = BubbleSession.userGroup(this);
        boolean admin = "admin".equals(role) || "super_chef".equals(role);
        boolean chef = "chef".equals(role);

        JSONArray names = groups.names();
        if (names == null) return visible;
        for (int i = 0; i < names.length(); i++) {
            String key = names.optString(i, "");
            JSONObject group = groups.optJSONObject(key);
            if (group == null) continue;
            String id = group.optString("id", key);
            if (id.isEmpty()) continue;
            boolean include = admin;
            if (!include && chef && me.equals(group.optString("chef_id", ""))) include = true;
            if (!include && !myGroup.isEmpty() && myGroup.equals(id)) include = true;
            if (!include && group.optBoolean("is_messenger")
                    && containsId(group.optJSONArray("membre_ids"), me)) {
                include = true;
            }
            if (include) visible.add(id);
        }
        return visible;
    }

    private void renderStack() {
        if (stackView == null) return;
        stackView.removeAllViews();
        updateHeadsBackdrop();
        if (incomingCall != null && !headsOpen) {
            stackView.addView(buildIncomingCallHead());
            return;
        }
        if (incomingCall != null) {
            stackView.addView(buildIncomingCallHead());
        }
        if (chats.isEmpty()) {
            if (incomingCall == null) stackView.addView(buildEmptyBubble());
            return;
        }
        if (!headsOpen) {
            stackView.addView(buildChatHead(chats.get(0), totalUnread()));
            return;
        }
        int shown = Math.min(chats.size(), MAX_HEADS);
        for (int i = 0; i < shown; i++) {
            stackView.addView(buildChatHead(chats.get(i), chats.get(i).unread));
        }
        if (chats.size() > MAX_HEADS) {
            stackView.addView(buildOverflowBubble(chats.size() - shown));
        }
    }

    private int totalUnread() {
        int total = 0;
        for (ChatHead chat : chats) total += Math.max(0, chat.unread);
        return total;
    }

    private void updateHeadsBackdrop() {
        if (headsBackdrop != null) {
            headsBackdrop.setVisibility(headsOpen && !expanded ? View.VISIBLE : View.GONE);
        }
    }

    private boolean onOverflowTouch(MotionEvent event) {
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
            case MotionEvent.ACTION_MOVE:
                return true;
            case MotionEvent.ACTION_UP:
                openApp("list", "list");
                return true;
            default:
                return false;
        }
    }

    private View buildEmptyBubble() {
        FrameLayout holder = new FrameLayout(this);
        holder.setLayoutParams(headParams(0));
        // Aucune conversation : afficher la bulle generique de l'application,
        // jamais la photo du compte connecte (elle faisait croire a un chat).
        View circle = buildCircle(
                "",
                "",
                "F",
                "#10b981"
        );
        holder.addView(circle, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        holder.setOnTouchListener((view, event) -> onHeadTouch(null, event));
        return holder;
    }

    private View buildIncomingCallHead() {
        FrameLayout holder = new FrameLayout(this);
        holder.setLayoutParams(headParams(dp(6)));
        View circle = buildCircle(
                incomingCall.peerPhoto,
                incomingCall.peerId,
                initial(incomingCall.peerName),
                "video".equals(incomingCall.callType) ? "#0ea5e9" : "#ef4444"
        );
        holder.addView(circle, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        TextView badge = new TextView(this);
        badge.setText("!");
        badge.setTextColor(Color.WHITE);
        badge.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        badge.setTypeface(Typeface.DEFAULT_BOLD);
        badge.setGravity(Gravity.CENTER);
        GradientDrawable badgeBackground = new GradientDrawable();
        badgeBackground.setShape(GradientDrawable.OVAL);
        badgeBackground.setColor(Color.parseColor("#dc2626"));
        badge.setBackground(badgeBackground);
        FrameLayout.LayoutParams badgeParams = new FrameLayout.LayoutParams(dp(20), dp(20));
        badgeParams.gravity = Gravity.TOP | Gravity.END;
        holder.addView(badge, badgeParams);
        holder.setOnTouchListener((view, event) -> onIncomingCallTouch(event));
        return holder;
    }

    private boolean onIncomingCallTouch(MotionEvent event) {
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                dragging = false;
                touchStartX = windowParams != null ? windowParams.x : 0;
                touchStartY = windowParams != null ? windowParams.y : 0;
                downRawX = event.getRawX();
                downRawY = event.getRawY();
                return true;
            case MotionEvent.ACTION_MOVE:
                if (windowParams == null) return true;
                float deltaX = event.getRawX() - downRawX;
                float deltaY = event.getRawY() - downRawY;
                if (Math.abs(deltaX) > dp(5) || Math.abs(deltaY) > dp(5)) dragging = true;
                if (dragging) {
                    int screenWidth = getResources().getDisplayMetrics().widthPixels;
                    int screenHeight = getResources().getDisplayMetrics().heightPixels;
                    windowParams.x = clamp((int) (touchStartX + deltaX), 0,
                            Math.max(0, screenWidth - contentWidth()));
                    windowParams.y = clamp((int) (touchStartY + deltaY), 0,
                            Math.max(0, screenHeight - contentHeight()));
                    updateLayout();
                }
                return true;
            case MotionEvent.ACTION_UP:
                if (!dragging) {
                    if (incomingCall == null || incomingCall.peerId == null || incomingCall.peerId.isEmpty()) {
                        openApp("list", "list");
                    } else {
                        openApp("direct", incomingCall.peerId);
                    }
                } else {
                    persistPosition();
                }
                return true;
            default:
                return false;
        }
    }

    private View buildOverflowBubble(int extraCount) {
        FrameLayout holder = new FrameLayout(this);
        holder.setLayoutParams(headParams(dp(6)));
        FrameLayout frame = new FrameLayout(this);
        GradientDrawable ring = new GradientDrawable();
        ring.setShape(GradientDrawable.OVAL);
        ring.setColor(Color.parseColor("#334155"));
        ring.setStroke(dp(2), Color.parseColor("#94a3b8"));
        frame.setBackground(ring);
        frame.setElevation(dp(6));
        TextView label = new TextView(this);
        label.setText("+" + extraCount);
        label.setTextColor(Color.WHITE);
        label.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        label.setTypeface(Typeface.DEFAULT_BOLD);
        label.setGravity(Gravity.CENTER);
        frame.addView(label, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        holder.addView(frame, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        holder.setOnTouchListener((view, event) -> onOverflowTouch(event));
        return holder;
    }

    private View buildChatHead(ChatHead chat, int badgeCount) {
        FrameLayout holder = new FrameLayout(this);
        holder.setLayoutParams(headParams(dp(8)));

        View circle = buildCircle(
                chat.avatarUrl,
                chat.avatarMemberId,
                initial(chat.name),
                "group".equals(chat.type) ? "#f59e0b" : "#10b981"
        );
        holder.addView(circle, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        if (badgeCount > 0) {
            TextView badge = new TextView(this);
            badge.setText(badgeCount > 99 ? "99+" : String.valueOf(badgeCount));
            badge.setTextColor(Color.WHITE);
            badge.setTextSize(TypedValue.COMPLEX_UNIT_SP, 9);
            badge.setTypeface(Typeface.DEFAULT_BOLD);
            badge.setGravity(Gravity.CENTER);
            GradientDrawable badgeBackground = new GradientDrawable();
            badgeBackground.setShape(GradientDrawable.OVAL);
            badgeBackground.setColor(Color.parseColor("#ef4444"));
            badge.setBackground(badgeBackground);
            FrameLayout.LayoutParams badgeParams = new FrameLayout.LayoutParams(dp(20), dp(20));
            badgeParams.gravity = Gravity.TOP | Gravity.END;
            holder.addView(badge, badgeParams);
        }

        holder.setOnTouchListener((view, event) -> onHeadTouch(chat, event));
        return holder;
    }

    private LinearLayout.LayoutParams headParams(int bottomMargin) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(56), dp(56));
        params.bottomMargin = bottomMargin;
        return params;
    }

    private View buildCircle(String avatarUrl, String memberId, String letter, String ringColor) {
        FrameLayout frame = new FrameLayout(this);
        GradientDrawable ring = new GradientDrawable();
        ring.setShape(GradientDrawable.OVAL);
        ring.setColor(Color.parseColor("#0f172a"));
        ring.setStroke(dp(2), Color.parseColor(ringColor));
        frame.setBackground(ring);
        frame.setElevation(dp(7));

        TextView initialView = new TextView(this);
        initialView.setText(letter);
        initialView.setTextColor(Color.WHITE);
        initialView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        initialView.setTypeface(Typeface.DEFAULT_BOLD);
        initialView.setGravity(Gravity.CENTER);
        frame.addView(initialView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        ImageView image = new ImageView(this);
        image.setScaleType(ImageView.ScaleType.CENTER_CROP);
        image.setVisibility(View.GONE);
        FrameLayout.LayoutParams imageParams = new FrameLayout.LayoutParams(dp(50), dp(50));
        imageParams.gravity = Gravity.CENTER;
        frame.addView(image, imageParams);

        AvatarLoader.load(this, memberId, avatarUrl, bitmap -> {
            if (bitmap == null) return;
            image.setImageBitmap(bitmap);
            image.setVisibility(View.VISIBLE);
            initialView.setVisibility(View.GONE);
        });
        return frame;
    }

    private void showOverlay() {
        if (root != null || windowManager == null) return;
        if (!BubbleSession.isBubbleEnabled(this) || BubbleSession.isOverlayHidden(this)) return;

        windowParams = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                        ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                        : WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT
        );
        windowParams.gravity = Gravity.TOP | Gravity.START;

        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        int screenHeight = getResources().getDisplayMetrics().heightPixels;
        SharedPosition position = loadPosition();
        windowParams.x = clamp(position.x, 0, Math.max(0, screenWidth - dp(62)));
        windowParams.y = clamp(position.y, 0, Math.max(0, screenHeight - dp(90)));

        headsBackdrop = new View(this);
        headsBackdrop.setBackgroundColor(Color.TRANSPARENT);
        headsBackdrop.setVisibility(View.GONE);
        headsBackdrop.setClickable(true);
        headsBackdrop.setOnClickListener(view -> {
            if (expanded) {
                collapse();
            } else if (headsOpen) {
                headsOpen = false;
                renderStack();
            }
        });
        headsBackdropParams = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                        ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                        : WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT
        );
        headsBackdropParams.gravity = Gravity.TOP | Gravity.START;
        try {
            windowManager.addView(headsBackdrop, headsBackdropParams);
        } catch (Exception ignored) {
            headsBackdrop = null;
            headsBackdropParams = null;
        }

        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setClipChildren(false);

        stackView = new LinearLayout(this);
        stackView.setOrientation(LinearLayout.HORIZONTAL);
        stackView.setLayoutParams(new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        root.addView(stackView);

        panel = buildPanel();
        panel.setVisibility(View.GONE);
        panel.setLayoutParams(new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        root.addView(panel);

        try {
            windowManager.addView(root, windowParams);
        } catch (Exception error) {
            if (headsBackdrop != null && windowManager != null) {
                try {
                    windowManager.removeView(headsBackdrop);
                } catch (Exception ignored) {
                }
            }
            headsBackdrop = null;
            headsBackdropParams = null;
            root = null;
            stackView = null;
            panel = null;
            return;
        }
        renderStack();
    }

    private LinearLayout buildPanel() {
        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setPadding(dp(12), dp(10), dp(12), dp(10));
        GradientDrawable background = new GradientDrawable();
        background.setCornerRadius(dp(18));
        background.setColor(Color.parseColor("#111827"));
        background.setStroke(dp(1), Color.parseColor("#10b981"));
        container.setBackground(background);
        container.setElevation(dp(12));
        container.setLayoutParams(new LinearLayout.LayoutParams(dp(300), panelHeightPx));

        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);

        TextView back = new TextView(this);
        back.setText("<");
        back.setTextColor(Color.parseColor("#9ca3af"));
        back.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        back.setPadding(dp(6), 0, dp(8), 0);
        back.setOnClickListener(view -> collapse());
        header.addView(back);

        LinearLayout titles = new LinearLayout(this);
        titles.setOrientation(LinearLayout.VERTICAL);
        panelTitle = new TextView(this);
        panelTitle.setTextColor(Color.WHITE);
        panelTitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        panelTitle.setTypeface(Typeface.DEFAULT_BOLD);
        panelTitle.setMaxLines(1);
        titles.addView(panelTitle);
        panelSubtitle = new TextView(this);
        panelSubtitle.setTextColor(Color.parseColor("#9ca3af"));
        panelSubtitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10);
        panelSubtitle.setMaxLines(1);
        titles.addView(panelSubtitle);
        header.addView(titles, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        header.setOnTouchListener(this::onPanelTouch);
        container.addView(header);

        messagesScroll = new ScrollView(this);
        messagesScroll.setFillViewport(true);
        messagesContainer = new LinearLayout(this);
        messagesContainer.setOrientation(LinearLayout.VERTICAL);
        messagesContainer.setPadding(0, dp(8), 0, dp(8));
        messagesScroll.addView(messagesContainer, new ScrollView.LayoutParams(
                ScrollView.LayoutParams.MATCH_PARENT, ScrollView.LayoutParams.WRAP_CONTENT));
        container.addView(messagesScroll, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));

        LinearLayout inputRow = new LinearLayout(this);
        inputRow.setOrientation(LinearLayout.HORIZONTAL);
        inputRow.setGravity(Gravity.CENTER_VERTICAL);

        replyInput = new EditText(this);
        replyInput.setHint("Message...");
        replyInput.setHintTextColor(Color.parseColor("#6b7280"));
        replyInput.setTextColor(Color.WHITE);
        replyInput.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        replyInput.setInputType(InputType.TYPE_CLASS_TEXT
                | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
                | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        replyInput.setMinLines(1);
        replyInput.setMaxLines(3);
        GradientDrawable inputBackground = new GradientDrawable();
        inputBackground.setCornerRadius(dp(12));
        inputBackground.setColor(Color.parseColor("#1f2937"));
        replyInput.setBackground(inputBackground);
        replyInput.setPadding(dp(12), dp(9), dp(12), dp(9));
        inputRow.addView(replyInput, new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        TextView photoButton = new TextView(this);
        photoButton.setText("Photo");
        photoButton.setTextColor(Color.WHITE);
        photoButton.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        photoButton.setTypeface(Typeface.DEFAULT_BOLD);
        photoButton.setGravity(Gravity.CENTER);
        photoButton.setPadding(dp(8), dp(9), dp(8), dp(9));
        GradientDrawable photoBackground = new GradientDrawable();
        photoBackground.setCornerRadius(dp(14));
        photoBackground.setColor(Color.parseColor("#0ea5e9"));
        photoButton.setBackground(photoBackground);
        photoButton.setOnClickListener(view -> pickPhoto());
        LinearLayout.LayoutParams photoParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        photoParams.leftMargin = dp(8);
        inputRow.addView(photoButton, photoParams);

        sendButton = new TextView(this);
        sendButton.setText("Envoyer");
        sendButton.setTextColor(Color.WHITE);
        sendButton.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        sendButton.setTypeface(Typeface.DEFAULT_BOLD);
        sendButton.setGravity(Gravity.CENTER);
        sendButton.setPadding(dp(10), dp(9), dp(10), dp(9));
        GradientDrawable sendBackground = new GradientDrawable();
        sendBackground.setCornerRadius(dp(14));
        sendBackground.setColor(Color.parseColor("#10b981"));
        sendButton.setBackground(sendBackground);
        sendButton.setOnClickListener(view -> sendReply());
        LinearLayout.LayoutParams sendParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        sendParams.leftMargin = dp(8);
        inputRow.addView(sendButton, sendParams);

        container.addView(inputRow, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        return container;
    }

    private boolean onHeadTouch(ChatHead chat, MotionEvent event) {
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                dragging = false;
                touchStartX = windowParams != null ? windowParams.x : 0;
                touchStartY = windowParams != null ? windowParams.y : 0;
                downRawX = event.getRawX();
                downRawY = event.getRawY();
                return true;
            case MotionEvent.ACTION_MOVE:
                if (windowParams == null) return true;
                float deltaX = event.getRawX() - downRawX;
                float deltaY = event.getRawY() - downRawY;
                if (Math.abs(deltaX) > dp(5) || Math.abs(deltaY) > dp(5)) dragging = true;
                if (dragging) {
                    int screenWidth = getResources().getDisplayMetrics().widthPixels;
                    int screenHeight = getResources().getDisplayMetrics().heightPixels;
                    windowParams.x = clamp((int) (touchStartX + deltaX), 0,
                            Math.max(0, screenWidth - contentWidth()));
                    windowParams.y = clamp((int) (touchStartY + deltaY), 0,
                            Math.max(0, screenHeight - contentHeight()));
                    updateLayout();
                    if (deltaY > dp(70) && windowParams.y > Math.max(0, screenHeight - dp(240))) {
                        showDeleteTarget();
                    } else {
                        hideDeleteTarget();
                    }
                }
                return true;
            case MotionEvent.ACTION_UP:
                boolean removeFromScreen = deleteTargetVisible;
                hideDeleteTarget();
                if (!dragging) {
                    if (chat == null) {
                        // Bulle vide : ouvrir directement la liste des messages.
                        openApp("list", "list");
                    } else if (chats.size() <= 1 || headsOpen) {
                        // Une seule conversation (ou tete deja choisie) : un
                        // simple appui ouvre le chat, sans second clic.
                        // Si la fenetre de conversation n'est pas disponible,
                        // on ouvre directement l'application : un appui doit
                        // toujours produire une action visible.
                        if (panel == null || root == null) {
                            openApp(chat.type, chat.id);
                        } else {
                            openChat(chat);
                        }
                    } else {
                        // Plusieurs conversations : premier appui pour deployer
                        // les tetes, le suivant ouvre celle choisie.
                        headsOpen = true;
                        renderStack();
                        updateLayout();
                    }
                } else if (removeFromScreen) {
                    hideBubbleOverlay();
                    Toast.makeText(this, "Bulle masquee. Un nouveau message la fera revenir.",
                            Toast.LENGTH_SHORT).show();
                } else {
                    persistPosition();
                }
                return true;
            default:
                return false;
        }
    }

    private boolean onPanelTouch(View view, MotionEvent event) {
        if (windowParams == null) return false;
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                dragging = false;
                touchStartX = windowParams.x;
                touchStartY = windowParams.y;
                downRawX = event.getRawX();
                downRawY = event.getRawY();
                return true;
            case MotionEvent.ACTION_MOVE:
                float deltaX = event.getRawX() - downRawX;
                float deltaY = event.getRawY() - downRawY;
                if (Math.abs(deltaX) > dp(5) || Math.abs(deltaY) > dp(5)) dragging = true;
                if (dragging) {
                    int screenWidth = getResources().getDisplayMetrics().widthPixels;
                    int screenHeight = getResources().getDisplayMetrics().heightPixels;
                    windowParams.x = clamp((int) (touchStartX + deltaX), 0,
                            Math.max(0, screenWidth - contentWidth()));
                    windowParams.y = clamp((int) (touchStartY + deltaY), 0,
                            Math.max(0, screenHeight - contentHeight()));
                    updateLayout();
                }
                return true;
            case MotionEvent.ACTION_UP:
                if (dragging) persistPosition();
                return true;
            default:
                return false;
        }
    }

    private void openChat(ChatHead chat) {
        if (chat == null || panel == null || root == null) return;
        selectedType = chat.type;
        selectedId = chat.id;
        chat.unread = 0;
        expanded = true;
        headsOpen = true;
        updateHeadsBackdrop();

        MessageNotifier.cancelChat(this, chat.type, chat.id);
        stackView.setVisibility(View.VISIBLE);
        panel.setVisibility(View.VISIBLE);

        windowParams.flags = WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;
        windowParams.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN;
        android.util.DisplayMetrics metrics = getResources().getDisplayMetrics();
        windowParams.x = clamp(windowParams.x, 0, Math.max(0, metrics.widthPixels - contentWidth()));
        windowParams.y = clamp(windowParams.y, 0, Math.max(0, metrics.heightPixels - contentHeight()));
        updateLayout();

        renderConversation(false);
        renderStack();
        markSelectedRead();
        replyInput.postDelayed(() -> {
            if (replyInput == null) return;
            replyInput.requestFocus();
            InputMethodManager keyboard =
                    (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            if (keyboard != null) {
                keyboard.showSoftInput(replyInput, InputMethodManager.SHOW_IMPLICIT);
            }
        }, 150);
    }

    private void collapse() {
        headsOpen = false;
        updateHeadsBackdrop();
        if (panel == null || root == null) return;
        expanded = false;
        InputMethodManager keyboard =
                (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (keyboard != null && replyInput != null) {
            keyboard.hideSoftInputFromWindow(replyInput.getWindowToken(), 0);
            replyInput.clearFocus();
        }
        if (panel != null) panel.setVisibility(View.GONE);
        if (stackView != null) stackView.setVisibility(View.VISIBLE);
        if (windowParams != null) {
            windowParams.flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                    | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                    | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;
            int screenWidth = getResources().getDisplayMetrics().widthPixels;
            windowParams.x = clamp(windowParams.x, 0, Math.max(0, screenWidth - contentWidth()));
            updateLayout();
        }
        renderStack();
    }

    private void renderConversation(boolean keepScroll) {
        if (messagesContainer == null || panelTitle == null) return;
        String me = BubbleSession.userId(this);
        ChatHead active = null;
        for (ChatHead chat : chats) {
            if (chat.type.equals(selectedType) && chat.id.equals(selectedId)) {
                active = chat;
                break;
            }
        }
        panelTitle.setText(active != null ? active.name : "Conversation");
        panelSubtitle.setText("group".equals(selectedType) ? "Groupe" : "Discussion privee");

        List<JSONObject> list = new ArrayList<>();
        for (int i = 0; i < cachedMessages.length(); i++) {
            JSONObject message = cachedMessages.optJSONObject(i);
            if (message == null || message.optBoolean("is_deleted")) continue;
            if (!matchesSelection(message, me)) continue;
            list.add(message);
        }
        Collections.sort(list, (left, right) -> {
            String a = left.optString("sent_at", "");
            String b = right.optString("sent_at", "");
            int compare = a.compareTo(b);
            if (compare != 0) return compare;
            return left.optString("id", "").compareTo(right.optString("id", ""));
        });
        if (list.size() > 60) list = new ArrayList<>(list.subList(list.size() - 60, list.size()));

        messagesContainer.removeAllViews();
        if (list.isEmpty()) {
            TextView empty = new TextView(this);
            empty.setText("Aucun message pour le moment.");
            empty.setTextColor(Color.parseColor("#9ca3af"));
            empty.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
            empty.setGravity(Gravity.CENTER);
            empty.setPadding(0, dp(24), 0, dp(24));
            messagesContainer.addView(empty);
        } else {
            for (JSONObject message : list) {
                messagesContainer.addView(buildMessageRow(message, me));
            }
        }

        if (!keepScroll || list.isEmpty()) {
            messagesScroll.post(() -> messagesScroll.fullScroll(View.FOCUS_DOWN));
        } else {
            messagesScroll.post(() -> messagesScroll.fullScroll(View.FOCUS_DOWN));
        }
    }

    private boolean matchesSelection(JSONObject message, String me) {
        if ("group".equals(selectedType)) {
            return selectedId.equals(message.optString("group_id", ""));
        }
        String senderId = message.optString("sender_id", "");
        String receiverId = message.optString("receiver_id", "");
        return (selectedId.equals(senderId) && me.equals(receiverId))
                || (me.equals(senderId) && selectedId.equals(receiverId));
    }

    private View buildMessageRow(JSONObject message, String me) {
        boolean mine = me.equals(message.optString("sender_id"));
        boolean hasImage = !message.optString("image_ref", "").isEmpty()
                || !message.optString("image_url", "").isEmpty()
                || ("image".equals(message.optString("file_type", ""))
                        && !message.optString("file_url", "").isEmpty());
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(mine ? Gravity.END : Gravity.START);
        LinearLayout.LayoutParams rowParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        rowParams.topMargin = dp(6);
        row.setLayoutParams(rowParams);

        LinearLayout bubble = new LinearLayout(this);
        bubble.setOrientation(LinearLayout.VERTICAL);
        bubble.setPadding(dp(10), dp(7), dp(10), dp(7));
        GradientDrawable background = new GradientDrawable();
        background.setCornerRadius(dp(14));
        background.setColor(Color.parseColor(mine ? "#065f46" : "#1f2937"));
        bubble.setBackground(background);

        if (!mine && "group".equals(selectedType)) {
            TextView sender = new TextView(this);
            sender.setText(memberName(cachedMembers.optJSONObject(message.optString("sender_id"))));
            sender.setTextColor(Color.parseColor("#34d399"));
            sender.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10);
            sender.setTypeface(Typeface.DEFAULT_BOLD);
            bubble.addView(sender);
        }

        if (hasImage) {
            String imageRef = message.optString("image_ref", "");
            String imageUrl = message.optString("image_url", "");
            String fileUrl = message.optString("file_url", "");
            ImageView image = new ImageView(this);
            image.setScaleType(ImageView.ScaleType.CENTER_CROP);
            image.setVisibility(View.GONE);
            LinearLayout.LayoutParams imageParams = new LinearLayout.LayoutParams(dp(190), dp(140));
            imageParams.bottomMargin = dp(6);
            image.setLayoutParams(imageParams);
            bubble.addView(image);
            AvatarLoader.loadImage(this, imageRef, imageUrl, fileUrl, bitmap -> {
                if (bitmap == null) return;
                image.setImageBitmap(bitmap);
                image.setVisibility(View.VISIBLE);
            });
        }

        String caption = message.optString("message", "").trim();
        String textContent = hasImage ? caption : preview(message);
        if (!hasImage || !caption.isEmpty()) {
            TextView text = new TextView(this);
            text.setText(textContent);
            text.setTextColor(Color.WHITE);
            text.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
            text.setMaxWidth(dp(210));
            bubble.addView(text);
        }

        TextView time = new TextView(this);
        String sentAt = message.optString("sent_at", "");
        time.setText(sentAt.length() >= 5 ? sentAt.substring(sentAt.length() - 5) : sentAt);
        time.setTextColor(Color.parseColor("#9ca3af"));
        time.setTextSize(TypedValue.COMPLEX_UNIT_SP, 9);
        time.setGravity(mine ? Gravity.END : Gravity.START);
        bubble.addView(time);

        row.addView(bubble);
        return row;
    }

    private void markSelectedRead() {
        if (selectedType.isEmpty() || selectedId.isEmpty()) return;
        String me = BubbleSession.userId(this);
        if ("direct".equals(selectedType)) {
            for (int i = 0; i < cachedMessages.length(); i++) {
                JSONObject message = cachedMessages.optJSONObject(i);
                if (message == null) continue;
                if (selectedId.equals(message.optString("sender_id"))
                        && me.equals(message.optString("receiver_id"))) {
                    try {
                        message.put("status", "read");
                    } catch (Exception ignored) {
                        /* ignore */
                    }
                }
            }
            SupabaseRest.markDirectRead(this, selectedId, null);
        } else {
            try {
                cachedReads.put(me + ":" + selectedId, SupabaseRest.nowCursor());
            } catch (Exception ignored) {
                /* ignore */
            }
            SupabaseRest.markGroupRead(this, selectedId, null);
        }
        for (ChatHead chat : chats) {
            if (chat.type.equals(selectedType) && chat.id.equals(selectedId)) {
                chat.unread = 0;
            }
        }
        renderStack();
    }

    private void pickPhoto() {
        if (selectedId.isEmpty()) {
            Toast.makeText(this, "Ouvrez d'abord une discussion.", Toast.LENGTH_SHORT).show();
            return;
        }
        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction(ACTION_PICK_BUBBLE_PHOTO);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        try {
            startActivity(intent);
        } catch (Exception ignored) {
            Toast.makeText(this, "Galerie indisponible.", Toast.LENGTH_SHORT).show();
        }
    }

    private void sendPhotoFromBubble(String dataUrl) {
        if (selectedId.isEmpty()) {
            Toast.makeText(this, "Ouvrez d'abord une discussion.", Toast.LENGTH_SHORT).show();
            return;
        }
        if (!BubbleSession.isReady(this)) {
            Toast.makeText(this, "Session indisponible, ouvrez l'application.", Toast.LENGTH_SHORT).show();
            return;
        }
        final String peerId = "direct".equals(selectedType) ? selectedId : "";
        final String groupId = "group".equals(selectedType) ? selectedId : "";
        String messageId = "msg_local_" + System.currentTimeMillis();
        try {
            JSONObject optimistic = new JSONObject();
            optimistic.put("id", messageId);
            optimistic.put("sender_id", BubbleSession.userId(this));
            if (!peerId.isEmpty()) optimistic.put("receiver_id", peerId);
            if (!groupId.isEmpty()) optimistic.put("group_id", groupId);
            optimistic.put("message", "");
            optimistic.put("status", "sent");
            optimistic.put("is_deleted", false);
            optimistic.put("is_edited", false);
            optimistic.put("sent_at", SupabaseRest.nowMinute());
            optimistic.put("image_url", dataUrl);
            optimistic.put("file_type", "image");
            cachedMessages.put(optimistic);
            renderConversation(true);
        } catch (Exception ignored) {
        }
        SupabaseRest.sendPhotoReply(this, peerId, groupId, dataUrl, (success, error) -> {
            if (success) {
                mainHandler.postDelayed(this::pollOnce, 700);
            } else {
                Toast.makeText(BubbleService.this, "Envoi photo impossible, reessayez.",
                        Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void sendReply() {
        if (replyInput == null || sendButton == null) return;
        String text = replyInput.getText().toString().trim();
        if (text.isEmpty() || selectedId.isEmpty()) return;
        if (!BubbleSession.isReady(this)) {
            Toast.makeText(this, "Session indisponible, ouvrez l'application.", Toast.LENGTH_SHORT).show();
            return;
        }
        final String peerId = "direct".equals(selectedType) ? selectedId : "";
        final String groupId = "group".equals(selectedType) ? selectedId : "";

        sendButton.setEnabled(false);
        sendButton.setText("...");
        replyInput.setText("");

        try {
            JSONObject optimistic = new JSONObject();
            optimistic.put("id", "msg_local_" + System.currentTimeMillis());
            optimistic.put("sender_id", BubbleSession.userId(this));
            if (!peerId.isEmpty()) optimistic.put("receiver_id", peerId);
            if (!groupId.isEmpty()) optimistic.put("group_id", groupId);
            optimistic.put("message", text);
            optimistic.put("status", "sent");
            optimistic.put("is_deleted", false);
            optimistic.put("is_edited", false);
            optimistic.put("sent_at", SupabaseRest.nowMinute());
            cachedMessages.put(optimistic);
            renderConversation(true);
        } catch (Exception ignored) {
            /* message optimiste non affiche */
        }

        SupabaseRest.sendReply(this, peerId, groupId, text, (success, error) -> {
            if (sendButton != null) {
                sendButton.setEnabled(true);
                sendButton.setText("Envoyer");
            }
            if (success) {
                mainHandler.postDelayed(this::pollOnce, 700);
            } else {
                Toast.makeText(BubbleService.this, "Envoi impossible, reessayez.",
                        Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void openApp(String chatType, String chatId) {
        if (!chatId.isEmpty()) {
            BubbleSession.setPendingChat(this, chatType, chatId);
        }
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (!chatId.isEmpty()) {
            intent.putExtra(MessageNotifier.EXTRA_CHAT_TYPE, chatType);
            intent.putExtra(MessageNotifier.EXTRA_CHAT_ID, chatId);
        }
        try {
            startActivity(intent);
        } catch (Exception ignored) {
            /* demarrage refuse : la bulle reste affichee */
            Toast.makeText(this, "Impossible d'ouvrir l'application.",
                    Toast.LENGTH_SHORT).show();
            return;
        }
        collapse();
    }

    private void cancelAllChatNotifications() {
        for (ChatHead chat : chats) {
            MessageNotifier.cancelChat(this, chat.type, chat.id);
        }
    }

    private void updateServiceNotification(String text) {
        try {
            android.app.NotificationManager manager =
                    (android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (manager != null) {
                Notification notification = MessageNotifier.serviceNotification(this, text);
                manager.notify(MessageNotifier.serviceNotificationId(), notification);
            }
        } catch (Exception ignored) {
            /* notification indisponible */
        }
    }

    private void updateLayout() {
        if (root == null || windowParams == null || windowManager == null) return;
        try {
            windowManager.updateViewLayout(root, windowParams);
        } catch (Exception ignored) {
            /* vue retiree */
        }
    }

    private void hideBubbleOverlay() {
        BubbleSession.setOverlayHidden(this, true);
        expanded = false;
        headsOpen = false;
        removeOverlay();
    }

    private void showDeleteTarget() {
        if (deleteTargetVisible || windowManager == null) return;
        deleteTargetVisible = true;
        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        int screenHeight = getResources().getDisplayMetrics().heightPixels;
        deleteTargetParams = new WindowManager.LayoutParams(
                dp(78),
                dp(78),
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                        ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                        : WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT
        );
        deleteTargetParams.gravity = Gravity.TOP | Gravity.START;
        deleteTargetParams.x = Math.max(0, screenWidth / 2 - dp(39));
        deleteTargetParams.y = Math.max(0, screenHeight - dp(112));

        FrameLayout frame = new FrameLayout(this);
        GradientDrawable background = new GradientDrawable();
        background.setShape(GradientDrawable.OVAL);
        background.setColor(Color.parseColor("#dc2626"));
        background.setStroke(dp(3), Color.WHITE);
        frame.setBackground(background);
        frame.setElevation(dp(12));
        TextView label = new TextView(this);
        label.setText("✕");
        label.setTextColor(Color.WHITE);
        label.setTextSize(TypedValue.COMPLEX_UNIT_SP, 30);
        label.setTypeface(Typeface.DEFAULT_BOLD);
        label.setGravity(Gravity.CENTER);
        frame.addView(label, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        deleteTarget = frame;
        try {
            windowManager.addView(deleteTarget, deleteTargetParams);
        } catch (Exception ignored) {
            deleteTarget = null;
            deleteTargetParams = null;
            deleteTargetVisible = false;
        }
    }

    private void hideDeleteTarget() {
        if (!deleteTargetVisible && deleteTarget == null) return;
        deleteTargetVisible = false;
        if (deleteTarget != null && windowManager != null) {
            try {
                windowManager.removeView(deleteTarget);
            } catch (Exception ignored) {
            }
        }
        deleteTarget = null;
        deleteTargetParams = null;
    }

    private void removeOverlay() {
        hideDeleteTarget();
        if (root != null && windowManager != null) {
            try {
                windowManager.removeView(root);
            } catch (Exception ignored) {
            }
        }
        if (headsBackdrop != null && windowManager != null) {
            try {
                windowManager.removeView(headsBackdrop);
            } catch (Exception ignored) {
            }
        }
        headsBackdrop = null;
        headsBackdropParams = null;
        root = null;
        stackView = null;
        panel = null;
    }

    private void persistPosition() {
        if (windowParams == null) return;
        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                .putInt("x", windowParams.x)
                .putInt("y", windowParams.y)
                .apply();
    }

    private SharedPosition loadPosition() {
        android.content.SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        int screenHeight = getResources().getDisplayMetrics().heightPixels;
        return new SharedPosition(
                prefs.getInt("x", Math.max(0, screenWidth - dp(72))),
                prefs.getInt("y", Math.max(dp(90), screenHeight / 2))
        );
    }

    private int contentWidth() {
        return expanded
                ? Math.max(dp(300), dp(56) * Math.min(MAX_HEADS, Math.max(1, chats.size())) + dp(28))
                : dp(58);
    }

    private int contentHeight() {
        return expanded ? panelHeightPx + dp(66) : dp(66);
    }

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics()));
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    private static String initial(String name) {
        String trimmed = name == null ? "" : name.trim();
        return trimmed.isEmpty() ? "F" : trimmed.substring(0, 1).toUpperCase();
    }

    private static String memberName(JSONObject member) {
        if (member == null) return "Membre";
        String prenom = member.optString("prenom", "");
        String nom = member.optString("nom", "");
        String full = (prenom + " " + nom).trim();
        return full.isEmpty() ? "Membre" : full;
    }

    private static boolean containsId(JSONArray array, String id) {
        if (array == null || id.isEmpty()) return false;
        for (int i = 0; i < array.length(); i++) {
            if (id.equals(array.optString(i))) return true;
        }
        return false;
    }

    private static JSONObject indexById(JSONArray array) {
        JSONObject map = new JSONObject();
        if (array == null) return map;
        for (int i = 0; i < array.length(); i++) {
            JSONObject item = array.optJSONObject(i);
            if (item == null) continue;
            String id = item.optString("id", "");
            if (id.isEmpty()) continue;
            try {
                map.put(id, item);
            } catch (Exception ignored) {
                /* ignore */
            }
        }
        return map;
    }

    private static String preview(JSONObject message) {
        String text = message.optString("message", "");
        String fileType = message.optString("file_type", "");
        if (!message.optString("image_ref", "").isEmpty()
                || !message.optString("image_url", "").isEmpty()
                || "image".equals(fileType)) {
            return "[Photo] " + text;
        }
        if ("audio".equals(fileType) || !message.optString("audio_url", "").isEmpty()) {
            return "[Audio] " + (text.isEmpty() ? message.optString("file_name", "") : text);
        }
        if ("document".equals(fileType) || !message.optString("file_url", "").isEmpty()) {
            return "[Fichier] " + (text.isEmpty() ? message.optString("file_name", "") : text);
        }
        return text;
    }

    private static final class ChatHead {
        String type = "";
        String id = "";
        String name = "";
        String avatarUrl = "";
        String avatarMemberId = "";
        String lastText = "";
        String lastSender = "";
        String lastAt = "";
        int unread;
    }

    private static final class IncomingCallState {
        final String peerId;
        final String peerName;
        final String peerPhoto;
        final String callType;

        IncomingCallState(String peerId, String peerName, String peerPhoto, String callType) {
            this.peerId = peerId == null ? "" : peerId;
            this.peerName = peerName == null ? "" : peerName;
            this.peerPhoto = peerPhoto == null ? "" : peerPhoto;
            this.callType = "video".equals(callType) ? "video" : "voice";
        }
    }

    private static final class SharedPosition {
        final int x;
        final int y;

        SharedPosition(int x, int y) {
            this.x = x;
            this.y = y;
        }
    }
}
