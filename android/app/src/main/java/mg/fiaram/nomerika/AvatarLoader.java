package mg.fiaram.nomerika;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Shader;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Charge les photos de profil pour les bulles. Les avatars peuvent etre une
 * URL http(s), une data URL base64, ou une reference vers la ligne
 * fiaram_memberimg_<id>_avatar. Le resultat est mis en cache et recadre en
 * cercle pour ressembler aux chat heads de Messenger.
 */
final class AvatarLoader {
    private static final ExecutorService executor = Executors.newFixedThreadPool(2);
    private static final Map<String, Bitmap> cache = new HashMap<>();
    private static final Map<String, Bitmap> imageCache = new HashMap<>();
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());
    private static final int TARGET_SIZE = 160;
    private static final int IMAGE_MAX_SIZE = 1024;

    interface Callback {
        void onBitmap(Bitmap bitmap);
    }

    private AvatarLoader() {
    }

    static void load(Context context, String memberId, String photoUrl, Callback callback) {
        final String key = (memberId == null ? "" : memberId) + "|" + (photoUrl == null ? "" : photoUrl);
        Bitmap cached;
        synchronized (cache) {
            cached = cache.get(key);
            if (cached != null) {
                deliver(callback, cached);
                return;
            }
        }
        final Context appContext = context.getApplicationContext();
        executor.execute(() -> {
            Bitmap bitmap = resolve(appContext, memberId, photoUrl);
            if (bitmap != null) {
                synchronized (cache) {
                    if (cache.size() > 60) cache.clear();
                    cache.put(key, bitmap);
                }
            }
            deliver(callback, bitmap);
        });
    }

    static void loadImage(Context context, String imageRef, String imageUrl, String fileUrl, Callback callback) {
        final String source = firstNonEmpty(imageUrl, fileUrl);
        final String key = "img|" + (imageRef == null ? "" : imageRef) + "|" + source;
        Bitmap cached;
        synchronized (imageCache) {
            cached = imageCache.get(key);
            if (cached != null) {
                deliver(callback, cached);
                return;
            }
        }
        final Context appContext = context.getApplicationContext();
        executor.execute(() -> {
            Bitmap bitmap = resolveImage(appContext, imageRef, imageUrl, fileUrl);
            if (bitmap != null) {
                synchronized (imageCache) {
                    if (imageCache.size() > 30) imageCache.clear();
                    imageCache.put(key, bitmap);
                }
            }
            deliver(callback, bitmap);
        });
    }

    private static Bitmap resolveImage(Context context, String imageRef, String imageUrl, String fileUrl) {
        String source = firstNonEmpty(imageUrl, fileUrl);
        if (source.isEmpty() && imageRef != null && !imageRef.isEmpty()) {
            try {
                SupabaseRest.Row row = SupabaseRest.fetchRow(context, "fiaram_msgimg_" + imageRef);
                if (row.exists && row.value instanceof String) {
                    source = (String) row.value;
                }
            } catch (Exception ignored) {
            }
        }
        if (source.isEmpty()) return null;
        try {
            if (source.startsWith("data:")) {
                int marker = source.indexOf("base64,");
                if (marker < 0) return null;
                return decodeImageBytes(Base64.decode(source.substring(marker + "base64,".length()), Base64.DEFAULT));
            }
            if (source.startsWith("http://") || source.startsWith("https://")) {
                return downloadImage(source);
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private static String firstNonEmpty(String first, String second) {
        if (first != null && !first.trim().isEmpty()) return first.trim();
        if (second != null && !second.trim().isEmpty()) return second.trim();
        return "";
    }

    private static Bitmap decodeImageBytes(byte[] bytes) {
        if (bytes == null || bytes.length == 0) return null;
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;
        int sample = 1;
        while (bounds.outWidth / (sample * 2) > IMAGE_MAX_SIZE
                || bounds.outHeight / (sample * 2) > IMAGE_MAX_SIZE) {
            sample *= 2;
        }
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = sample;
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
    }

    private static Bitmap downloadImage(String url) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(15000);
        connection.setRequestProperty("User-Agent", "FIARAM-NOMERIKA-Android");
        connection.setInstanceFollowRedirects(true);
        try {
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) return null;
            try (InputStream input = connection.getInputStream();
                 ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    output.write(buffer, 0, count);
                }
                return decodeImageBytes(output.toByteArray());
            }
        } finally {
            connection.disconnect();
        }
    }

    private static void deliver(Callback callback, Bitmap bitmap) {
        if (callback == null) return;
        mainHandler.post(() -> callback.onBitmap(bitmap));
    }

    private static Bitmap resolve(Context context, String memberId, String photoUrl) {
        String source = photoUrl == null ? "" : photoUrl.trim();
        if (source.isEmpty() || source.startsWith("fiaram-image-ref:")) {
            if (memberId != null && !memberId.isEmpty()) {
                try {
                    SupabaseRest.Row row = SupabaseRest.fetchRow(
                            context, "fiaram_memberimg_" + memberId + "_avatar");
                    if (row.exists && row.value instanceof String) {
                        source = (String) row.value;
                    }
                } catch (Exception ignored) {
                    /* avatar indisponible */
                }
            }
        }
        if (source.isEmpty()) return null;
        try {
            if (source.startsWith("data:")) {
                return circular(decodeDataUrl(source));
            }
            if (source.startsWith("http://") || source.startsWith("https://")) {
                return circular(download(source));
            }
        } catch (Exception ignored) {
            /* image illisible */
        }
        return null;
    }

    private static Bitmap decodeDataUrl(String dataUrl) {
        int marker = dataUrl.indexOf("base64,");
        if (marker < 0) return null;
        String payload = dataUrl.substring(marker + "base64,".length());
        byte[] bytes = Base64.decode(payload, Base64.DEFAULT);
        return decodeBytes(bytes);
    }

    private static Bitmap download(String url) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(15000);
        connection.setRequestProperty("User-Agent", "FIARAM-NOMERIKA-Android");
        connection.setInstanceFollowRedirects(true);
        try {
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) return null;
            try (InputStream input = connection.getInputStream();
                 ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    output.write(buffer, 0, count);
                }
                return decodeBytes(output.toByteArray());
            }
        } finally {
            connection.disconnect();
        }
    }

    private static Bitmap decodeBytes(byte[] bytes) {
        if (bytes == null || bytes.length == 0) return null;
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;

        BitmapFactory.Options options = new BitmapFactory.Options();
        int sample = 1;
        int smallest = Math.min(bounds.outWidth, bounds.outHeight);
        while (smallest / (sample * 2) >= TARGET_SIZE) {
            sample *= 2;
        }
        options.inSampleSize = sample;
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
    }

    private static Bitmap circular(Bitmap source) {
        if (source == null) return null;
        int size = Math.min(source.getWidth(), source.getHeight());
        if (size <= 0) return null;
        int outputSize = Math.min(size, TARGET_SIZE);
        Bitmap output = Bitmap.createBitmap(outputSize, outputSize, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(output);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        BitmapShader shader = new BitmapShader(source, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP);
        Matrix matrix = new Matrix();
        float scale = (float) outputSize / (float) size;
        matrix.setScale(scale, scale);
        matrix.postTranslate(
                (outputSize - source.getWidth() * scale) / 2f,
                (outputSize - source.getHeight() * scale) / 2f
        );
        shader.setLocalMatrix(matrix);
        paint.setShader(shader);
        float radius = outputSize / 2f;
        canvas.drawCircle(radius, radius, radius, paint);
        if (source != output) source.recycle();
        return output;
    }
}
