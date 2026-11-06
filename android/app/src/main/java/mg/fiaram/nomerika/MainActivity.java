package mg.fiaram.nomerika;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppUpdaterPlugin.class);
        registerPlugin(MessengerBubblePlugin.class);
        super.onCreate(savedInstanceState);
        handleChatIntent(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleChatIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        BubbleSession.setAppForeground(this, true);
    }

    @Override
    public void onPause() {
        BubbleSession.setAppForeground(this, false);
        super.onPause();
    }

    @Override
    public void onBackPressed() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null && webView.canGoBack()) {
            // The web app pushes one history entry per page, so the hardware
            // back button walks back through the app instead of closing it.
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    private void handleChatIntent(Intent intent) {
        if (intent == null) return;
        String chatId = intent.getStringExtra(MessageNotifier.EXTRA_CHAT_ID);
        if (chatId == null || chatId.isEmpty()) return;
        String chatType = intent.getStringExtra(MessageNotifier.EXTRA_CHAT_TYPE);
        BubbleSession.setPendingChat(this, chatType == null ? "direct" : chatType, chatId);
    }
}
