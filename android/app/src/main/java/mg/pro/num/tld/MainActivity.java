package mg.pro.num.tld;

import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

public class MainActivity extends BridgeActivity {
    private static final int REQUEST_BUBBLE_PHOTO = 4101;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppUpdaterPlugin.class);
        registerPlugin(MessengerBubblePlugin.class);
        super.onCreate(savedInstanceState);
        handleChatIntent(getIntent());
        handleBubblePhotoIntent(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleChatIntent(intent);
        handleBubblePhotoIntent(intent);
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

    private void handleBubblePhotoIntent(Intent intent) {
        if (intent == null) return;
        if (!BubbleService.ACTION_PICK_BUBBLE_PHOTO.equals(intent.getAction())) return;
        Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        picker.addCategory(Intent.CATEGORY_OPENABLE);
        picker.setType("image/*");
        picker.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        picker.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        try {
            startActivityForResult(picker, REQUEST_BUBBLE_PHOTO);
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_BUBBLE_PHOTO || resultCode != RESULT_OK || data == null) return;
        final Uri uri = data.getData();
        if (uri == null) return;
        try {
            getContentResolver().takePersistableUriPermission(
                    uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (Exception ignored) {
        }
        new Thread(() -> {
            String dataUrl = encodePickedImage(uri);
            if (dataUrl != null && !dataUrl.isEmpty()) {
                BubbleService.sendPhotoResult(getApplicationContext(), dataUrl);
            }
        }, "pronumtld-bubble-photo-picker").start();
    }

    private String encodePickedImage(Uri uri) {
        try (InputStream input = getContentResolver().openInputStream(uri);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            if (input == null) return null;
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) {
                output.write(buffer, 0, count);
            }
            byte[] bytes = output.toByteArray();
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;
            int sample = 1;
            while (bounds.outWidth / (sample * 2) > 1024 || bounds.outHeight / (sample * 2) > 1024) {
                sample *= 2;
            }
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inSampleSize = sample;
            Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
            if (bitmap == null) return null;
            ByteArrayOutputStream jpeg = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.JPEG, 80, jpeg);
            bitmap.recycle();
            return "data:image/jpeg;base64," + Base64.encodeToString(jpeg.toByteArray(), Base64.NO_WRAP);
        } catch (Exception ignored) {
            return null;
        }
    }
}
