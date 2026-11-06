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

    private static final String ACTION_START = "mg.fiaram.nomerika.BUBBLE_START";
    private static final String ACTION_SHOW = "mg.fiaram.nomerika.BUBBLE_SHOW";
    private static final String ACTION_CLEAR = "mg.fiaram.nomerika.BUBBLE_CLEAR";
    private static final String ACTION_REFRESH = "mg.fiaram.nomerika.BUBBLE_REFRESH";

    private static final String EXTRA_MESSAGE_ID = "message_id";
    private static final String EXTRA_PEER_ID = "peer_id";
    private static final String EXTRA_GROUP_ID = "group_id";
    private static final String EXTRA_SENDER_ID = "sender_id";
    private static final String EXTRA_SENDER_NAME = "sender_name";
    private static final String EXTRA_TEXT = "text";

    private static final long POLL_INTERVAL_MS = 30_000L;
    private static final int MAX_HEADS = 4;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private ExecutorService executor;

    private WindowManager windowManager;
    private WindowManager.LayoutParams windowParams;
    private FrameLayout root;
    private LinearLayout stackView;
    private LinearLayout panel;
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

    static void stop(Context context) {
        context.stopService(new Intent(context, BubbleService.class));
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
        if (Settings.canDrawOverlays(this)) showOverlay();
        mainHandler.postDelayed(pollRunnable, 1200);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : ACTION_START;
        if (ACTION_SHOW.equals(action) && intent != null) {
            if (!BubbleSession.isBubbleEnabled(this)) {
                stopSelf(startId);
                return START_NOT_STICKY;
            }
            handlePushedMessage(intent);
            pollOnce();
        } else if (ACTION_CLEAR.equals(action)) {
            cancelAllChatNotifications();
            if (!BubbleSession.isBubbleEnabled(this)) stopSelf(startId);
        } else if (ACTION_REFRESH.equals(action)) {
            if (BubbleSession.isBubbleEnabled(this)) {
                pollOnce();
            } else {
                stopSelf(startId);
            }
        } else {
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
                    if (BubbleSession.isBubbleEnabled(app)) {
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

        if (!incoming.isEmpty() && !BubbleSession.isAppForeground(this)
                && BubbleSession.isBubbleEnabled(this)) {
            for (JSONObject message : incoming) notifyForMessage(message, me, visibleGroups);
        }

        firstPollDone = true;
        renderStack();
        if (expanded) renderConversation(true);
        updateServiceNotification(chats.isEmpty()
                ? "Messenger actif"
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
        if (list.size() > MAX_HEADS) {
            return new ArrayList<>(list.subList(0, MAX_HEADS));
        }
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
        if (chats.isEmpty()) {
            stackView.addView(buildEmptyBubble());
            return;
        }
        for (ChatHead chat : chats) {
            stackView.addView(buildChatHead(chat));
        }
    }

    private View buildEmptyBubble() {
        FrameLayout holder = new FrameLayout(this);
        holder.setLayoutParams(headParams(0));
        View circle = buildCircle(
                BubbleSession.photoUrl(this),
                BubbleSession.userId(this),
                initial(BubbleSession.userName(this)),
                "#10b981"
        );
        holder.addView(circle, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        holder.setOnTouchListener((view, event) -> onHeadTouch(null, event));
        return holder;
    }

    private View buildChatHead(ChatHead chat) {
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

        if (chat.unread > 0) {
            TextView badge = new TextView(this);
            badge.setText(chat.unread > 99 ? "99+" : String.valueOf(chat.unread));
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

        root = new FrameLayout(this);
        root.setClipChildren(false);

        stackView = new LinearLayout(this);
        stackView.setOrientation(LinearLayout.VERTICAL);
        stackView.setLayoutParams(new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT));
        root.addView(stackView);

        panel = buildPanel();
        panel.setVisibility(View.GONE);
        root.addView(panel);

        try {
            windowManager.addView(root, windowParams);
        } catch (Exception error) {
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
        container.setLayoutParams(new FrameLayout.LayoutParams(dp(300), panelHeightPx));

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

        TextView close = new TextView(this);
        close.setText("x");
        close.setTextColor(Color.parseColor("#9ca3af"));
        close.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        close.setPadding(dp(8), 0, 0, 0);
        close.setOnClickListener(view -> collapse());
        header.addView(close);

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
                }
                return true;
            case MotionEvent.ACTION_UP:
                if (!dragging) {
                    if (chat == null) {
                        openApp("", "");
                    } else {
                        openChat(chat);
                    }
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

        MessageNotifier.cancelChat(this, chat.type, chat.id);
        stackView.setVisibility(View.GONE);
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
        if (!expanded || panel == null || root == null) return;
        expanded = false;
        InputMethodManager keyboard =
                (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (keyboard != null && replyInput != null) {
            keyboard.hideSoftInputFromWindow(replyInput.getWindowToken(), 0);
            replyInput.clearFocus();
        }
        panel.setVisibility(View.GONE);
        stackView.setVisibility(View.VISIBLE);
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

        TextView text = new TextView(this);
        text.setText(preview(message));
        text.setTextColor(Color.WHITE);
        text.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        text.setMaxWidth(dp(210));
        bubble.addView(text);

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

    private void removeOverlay() {
        if (root != null && windowManager != null) {
            try {
                windowManager.removeView(root);
            } catch (Exception ignored) {
                /* deja retiree */
            }
        }
        root = null;
        stackView = null;
        panel = null;
    }

    private void persistPosition() {
        if (windowParams == null) return;
        if (isFinishingOrDestroyed()) return;
        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                .putInt("x", windowParams.x)
                .putInt("y", windowParams.y)
                .apply();
    }

    private boolean isFinishingOrDestroyed() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1 && isDestroyed();
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
        return expanded ? dp(300) : dp(58);
    }

    private int contentHeight() {
        return expanded ? panelHeightPx : dp(70);
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

    private static final class SharedPosition {
        final int x;
        final int y;

        SharedPosition(int x, int y) {
            this.x = x;
            this.y = y;
        }
    }
}
