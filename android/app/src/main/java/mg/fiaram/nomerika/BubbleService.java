package mg.fiaram.nomerika;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
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
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

/**
 * Bulle flottante (chat head) affichee par-dessus les autres applications.
 * Elle permet de lire le dernier message et d'y repondre sans quitter ce que
 * l'utilisateur est en train de faire.
 */
public class BubbleService extends Service {
    private static final String CHANNEL_ID = "fiaram_messenger_bubble";
    private static final int NOTIFICATION_ID = 7301;
    private static final String PREFS = "fiaram_bubble_position";
    private static final String KEY_LAST_PEER = "last_peer";
    private static final String KEY_LAST_GROUP = "last_group";
    private static final String KEY_LAST_SENDER = "last_sender";
    private static final String KEY_LAST_TEXT = "last_text";
    private static final String KEY_UNREAD = "unread";

    private static final String ACTION_START = "mg.fiaram.nomerika.BUBBLE_START";
    private static final String ACTION_SHOW = "mg.fiaram.nomerika.BUBBLE_SHOW";
    private static final String ACTION_CLEAR = "mg.fiaram.nomerika.BUBBLE_CLEAR";

    private static final String EXTRA_MESSAGE_ID = "message_id";
    private static final String EXTRA_PEER_ID = "peer_id";
    private static final String EXTRA_GROUP_ID = "group_id";
    private static final String EXTRA_SENDER_ID = "sender_id";
    private static final String EXTRA_SENDER_NAME = "sender_name";
    private static final String EXTRA_TEXT = "text";

    private WindowManager windowManager;
    private WindowManager.LayoutParams windowParams;
    private FrameLayout root;
    private FrameLayout bubbleWrapper;
    private LinearLayout card;
    private TextView badgeView;
    private TextView lastSenderView;
    private TextView lastMessageView;
    private EditText replyInput;
    private TextView sendButton;

    private String lastPeerId = "";
    private String lastGroupId = "";
    private String lastSenderName = "";
    private String lastText = "";
    private int unread = 0;
    private boolean expanded = false;
    private boolean dragging = false;
    private int touchStartX;
    private int touchStartY;
    private float downRawX;
    private float downRawY;

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
            // Android peut refuser un demarrage depuis l'arriere-plan ; la
            // notification Firebase prend alors le relais.
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        startForeground(NOTIFICATION_ID, buildForegroundNotification("Bulle Messenger active"));
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        SharedPreferences saved = getSharedPreferences(PREFS, MODE_PRIVATE);
        lastPeerId = saved.getString(KEY_LAST_PEER, "");
        lastGroupId = saved.getString(KEY_LAST_GROUP, "");
        lastSenderName = saved.getString(KEY_LAST_SENDER, "");
        lastText = saved.getString(KEY_LAST_TEXT, "");
        unread = saved.getInt(KEY_UNREAD, 0);
        if (Settings.canDrawOverlays(this)) {
            showBubble();
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : ACTION_START;
        if (ACTION_SHOW.equals(action) && intent != null) {
            lastPeerId = safe(intent.getStringExtra(EXTRA_PEER_ID));
            lastGroupId = safe(intent.getStringExtra(EXTRA_GROUP_ID));
            lastSenderName = safe(intent.getStringExtra(EXTRA_SENDER_NAME));
            lastText = safe(intent.getStringExtra(EXTRA_TEXT));
            unread++;
            persistState();
            if (root == null && Settings.canDrawOverlays(this)) showBubble();
            applyMessage();
        } else if (ACTION_CLEAR.equals(action)) {
            unread = 0;
            persistState();
            updateBadge();
        } else if (ACTION_START.equals(action)) {
            if (root == null && Settings.canDrawOverlays(this)) showBubble();
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        removeBubble();
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

    private void showBubble() {
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

        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        int screenHeight = getResources().getDisplayMetrics().heightPixels;
        windowParams.x = prefs.getInt("x", Math.max(0, screenWidth - dp(74)));
        windowParams.y = prefs.getInt("y", Math.max(dp(90), screenHeight / 2));

        root = new FrameLayout(this);
        root.setClipChildren(false);
        root.addView(buildCollapsedBubble());
        root.addView(buildExpandedCard());
        card.setVisibility(View.GONE);

        try {
            windowManager.addView(root, windowParams);
        } catch (Exception error) {
            root = null;
        }
    }

    private View buildCollapsedBubble() {
        bubbleWrapper = new FrameLayout(this);
        FrameLayout.LayoutParams wrapperParams = new FrameLayout.LayoutParams(dp(60), dp(60));
        bubbleWrapper.setLayoutParams(wrapperParams);

        TextView bubble = new TextView(this);
        GradientDrawable background = new GradientDrawable();
        background.setShape(GradientDrawable.OVAL);
        background.setColor(Color.parseColor("#10b981"));
        background.setStroke(dp(2), Color.parseColor("#f59e0b"));
        bubble.setBackground(background);
        bubble.setText(initial(BubbleSession.userName(this)));
        bubble.setTextColor(Color.WHITE);
        bubble.setTextSize(TypedValue.COMPLEX_UNIT_SP, 24);
        bubble.setTypeface(Typeface.DEFAULT_BOLD);
        bubble.setGravity(Gravity.CENTER);
        bubble.setElevation(dp(8));
        FrameLayout.LayoutParams bubbleParams = new FrameLayout.LayoutParams(dp(58), dp(58));
        bubbleParams.gravity = Gravity.CENTER;
        bubbleWrapper.addView(bubble, bubbleParams);

        badgeView = new TextView(this);
        badgeView.setTextColor(Color.WHITE);
        badgeView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10);
        badgeView.setTypeface(Typeface.DEFAULT_BOLD);
        badgeView.setGravity(Gravity.CENTER);
        GradientDrawable badgeBackground = new GradientDrawable();
        badgeBackground.setShape(GradientDrawable.OVAL);
        badgeBackground.setColor(Color.parseColor("#ef4444"));
        badgeView.setBackground(badgeBackground);
        badgeView.setVisibility(View.GONE);
        FrameLayout.LayoutParams badgeParams = new FrameLayout.LayoutParams(dp(22), dp(22));
        badgeParams.gravity = Gravity.TOP | Gravity.END;
        bubbleWrapper.addView(badgeView, badgeParams);

        bubbleWrapper.setOnTouchListener(this::onBubbleTouch);
        return bubbleWrapper;
    }

    private View buildExpandedCard() {
        card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(14), dp(12), dp(14), dp(12));
        GradientDrawable background = new GradientDrawable();
        background.setCornerRadius(dp(18));
        background.setColor(Color.parseColor("#111827"));
        background.setStroke(dp(1), Color.parseColor("#f59e0b"));
        card.setBackground(background);
        card.setElevation(dp(12));
        FrameLayout.LayoutParams cardParams = new FrameLayout.LayoutParams(dp(300), FrameLayout.LayoutParams.WRAP_CONTENT);
        card.setLayoutParams(cardParams);

        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);

        lastSenderView = new TextView(this);
        lastSenderView.setTextColor(Color.WHITE);
        lastSenderView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        lastSenderView.setTypeface(Typeface.DEFAULT_BOLD);
        lastSenderView.setMaxLines(1);
        header.addView(lastSenderView, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        TextView close = new TextView(this);
        close.setText("×");
        close.setTextColor(Color.parseColor("#9ca3af"));
        close.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        close.setPadding(dp(8), 0, 0, 0);
        close.setOnClickListener(view -> collapse());
        header.addView(close);

        card.addView(header);

        lastMessageView = new TextView(this);
        lastMessageView.setTextColor(Color.parseColor("#d1d5db"));
        lastMessageView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        lastMessageView.setMaxLines(3);
        LinearLayout.LayoutParams messageParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        messageParams.topMargin = dp(8);
        card.addView(lastMessageView, messageParams);

        replyInput = new EditText(this);
        replyInput.setHint("Répondre...");
        replyInput.setHintTextColor(Color.parseColor("#6b7280"));
        replyInput.setTextColor(Color.WHITE);
        replyInput.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        replyInput.setInputType(InputType.TYPE_CLASS_TEXT
                | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
                | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        replyInput.setMinLines(1);
        replyInput.setMaxLines(3);
        GradientDrawable inputBackground = new GradientDrawable();
        inputBackground.setCornerRadius(dp(12));
        inputBackground.setColor(Color.parseColor("#1f2937"));
        replyInput.setBackground(inputBackground);
        replyInput.setPadding(dp(12), dp(10), dp(12), dp(10));
        LinearLayout.LayoutParams inputParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        inputParams.topMargin = dp(10);
        card.addView(replyInput, inputParams);

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setGravity(Gravity.END);
        LinearLayout.LayoutParams actionParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        actionParams.topMargin = dp(10);
        card.addView(actions, actionParams);

        TextView open = new TextView(this);
        open.setText("Ouvrir");
        open.setTextColor(Color.parseColor("#9ca3af"));
        open.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        open.setPadding(dp(10), dp(8), dp(10), dp(8));
        open.setOnClickListener(view -> openApp());
        actions.addView(open);

        sendButton = new TextView(this);
        sendButton.setText("Envoyer");
        sendButton.setTextColor(Color.WHITE);
        sendButton.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        sendButton.setTypeface(Typeface.DEFAULT_BOLD);
        sendButton.setGravity(Gravity.CENTER);
        sendButton.setPadding(dp(16), dp(9), dp(16), dp(9));
        GradientDrawable sendBackground = new GradientDrawable();
        sendBackground.setCornerRadius(dp(14));
        sendBackground.setColor(Color.parseColor("#10b981"));
        sendButton.setBackground(sendBackground);
        sendButton.setOnClickListener(view -> sendReply());
        actions.addView(sendButton);

        return card;
    }

    private boolean onBubbleTouch(View view, MotionEvent event) {
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
                    int width = getResources().getDisplayMetrics().widthPixels;
                    int height = getResources().getDisplayMetrics().heightPixels;
                    windowParams.x = clamp((int) (touchStartX + deltaX), 0, Math.max(0, width - dp(62)));
                    windowParams.y = clamp((int) (touchStartY + deltaY), 0, Math.max(0, height - dp(80)));
                    try {
                        windowManager.updateViewLayout(root, windowParams);
                    } catch (Exception ignored) {
                        /* vue retiree */
                    }
                }
                return true;
            case MotionEvent.ACTION_UP:
                if (!dragging) {
                    expand();
                } else {
                    persistPosition();
                }
                return true;
            default:
                return false;
        }
    }

    private void expand() {
        if (expanded || card == null || root == null) return;
        expanded = true;
        unread = 0;
        persistState();
        updateBadge();
        bubbleWrapper.setVisibility(View.GONE);
        card.setVisibility(View.VISIBLE);
        applyMessage();
        windowParams.flags = WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;
        windowParams.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN;
        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        windowParams.x = clamp(windowParams.x, 0, Math.max(0, screenWidth - dp(312)));
        try {
            windowManager.updateViewLayout(root, windowParams);
        } catch (Exception ignored) {
            /* vue retiree */
        }
        replyInput.postDelayed(() -> {
            replyInput.requestFocus();
            InputMethodManager keyboard =
                    (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            if (keyboard != null) {
                keyboard.showSoftInput(replyInput, InputMethodManager.SHOW_IMPLICIT);
            }
        }, 120);
    }

    private void collapse() {
        if (!expanded || card == null || root == null) return;
        expanded = false;
        InputMethodManager keyboard =
                (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (keyboard != null) keyboard.hideSoftInputFromWindow(replyInput.getWindowToken(), 0);
        replyInput.clearFocus();
        card.setVisibility(View.GONE);
        bubbleWrapper.setVisibility(View.VISIBLE);
        windowParams.flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;
        try {
            windowManager.updateViewLayout(root, windowParams);
        } catch (Exception ignored) {
            /* vue retiree */
        }
    }

    private void applyMessage() {
        if (lastSenderView == null || lastMessageView == null) return;
        lastSenderView.setText(lastSenderName.isEmpty() ? "Nouveau message" : lastSenderName);
        lastMessageView.setText(lastText.isEmpty() ? "Nouveau message reçu" : lastText);
        updateBadge();
    }

    private void updateBadge() {
        if (badgeView == null) return;
        if (unread > 0) {
            badgeView.setText(unread > 99 ? "99+" : String.valueOf(unread));
            badgeView.setVisibility(View.VISIBLE);
        } else {
            badgeView.setVisibility(View.GONE);
        }
    }

    private void sendReply() {
        if (replyInput == null || sendButton == null) return;
        String text = replyInput.getText().toString().trim();
        if (text.isEmpty()) return;
        if (!BubbleSession.isReady(this)) {
            Toast.makeText(this, "Session indisponible, ouvrez l'application.", Toast.LENGTH_SHORT).show();
            return;
        }
        sendButton.setEnabled(false);
        sendButton.setText("...");
        SupabaseRest.sendReply(this, lastPeerId, lastGroupId, text, (success, error) -> {
            sendButton.setEnabled(true);
            sendButton.setText("Envoyer");
            if (success) {
                replyInput.setText("");
                lastSenderName = "Vous";
                lastText = text;
                unread = 0;
                persistState();
                applyMessage();
                Toast.makeText(BubbleService.this, "Message envoyé", Toast.LENGTH_SHORT).show();
                new Handler(Looper.getMainLooper()).postDelayed(this::collapse, 700);
            } else {
                Toast.makeText(BubbleService.this, "Envoi impossible, réessayez.", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void openApp() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(intent);
        collapse();
    }

    private void removeBubble() {
        if (root != null && windowManager != null) {
            try {
                windowManager.removeView(root);
            } catch (Exception ignored) {
                /* deja retiree */
            }
        }
        root = null;
        bubbleWrapper = null;
        card = null;
    }

    private void persistPosition() {
        if (windowParams == null) return;
        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                .putInt("x", windowParams.x)
                .putInt("y", windowParams.y)
                .apply();
    }

    private void persistState() {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                .putString(KEY_LAST_PEER, lastPeerId)
                .putString(KEY_LAST_GROUP, lastGroupId)
                .putString(KEY_LAST_SENDER, lastSenderName)
                .putString(KEY_LAST_TEXT, lastText)
                .putInt(KEY_UNREAD, unread)
                .apply();
    }

    private Notification buildForegroundNotification(String text) {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_email)
                .setContentTitle("FIARAM NUMERIQUE")
                .setContentText(text)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Bulle Messenger",
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Maintient la bulle de discussion visible");
        manager.createNotificationChannel(channel);
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
}
