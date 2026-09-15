package com.motiontimisoara.app.push;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.motiontimisoara.app.MainActivity;
import com.motiontimisoara.app.R;
import java.util.Map;

public final class MotionPushNotifications {
    public static final String CHANNEL_ID = "motion-updates";

    private MotionPushNotifications() {}

    public static void createChannel(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Actualizări Motion", NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription("Anunțuri, prezență și cursuri sau tabere noi pentru părinți.");
        manager.createNotificationChannel(channel);
    }

    public static boolean allowed(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) {
            return false;
        }
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        NotificationChannel channel = manager == null ? null : manager.getNotificationChannel(CHANNEL_ID);
        return manager != null && (channel == null || channel.getImportance() != NotificationManager.IMPORTANCE_NONE);
    }

    public static boolean show(Context context, MotionPushPayload payload) {
        createChannel(context);
        if (!allowed(context)) {
            return false;
        }
        Intent intent = new Intent(context, MainActivity.class)
            .setAction("com.motiontimisoara.app.PUSH." + payload.historyKey())
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra("google.message_id", payload.eventId);
        for (Map.Entry<String, String> item : payload.data().entrySet()) {
            intent.putExtra(item.getKey(), item.getValue());
        }
        PendingIntent tap = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder notification = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_motion)
            .setContentTitle(payload.title())
            .setContentText(payload.body())
            .setStyle(new NotificationCompat.BigTextStyle().bigText(payload.body()))
            .setContentIntent(tap)
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .setTimeoutAfter(Math.max(1, payload.expiresAt - System.currentTimeMillis()));
        try {
            NotificationManagerCompat.from(context).notify("motion-push:" + payload.historyKey(), 0, notification.build());
            return true;
        } catch (SecurityException exception) {
            return false;
        }
    }
}
