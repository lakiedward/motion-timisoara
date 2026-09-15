package com.motiontimisoara.app.push;

import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import java.util.UUID;

public final class MotionPushState {
    private static MotionPushState instance;
    private final Context context;
    private final SharedPreferences preferences;
    private final MotionPushSession session;
    private final MotionPushHistory history;
    private final String installationId;

    private MotionPushState(Context context) {
        this.context = context.getApplicationContext();
        preferences = this.context.getSharedPreferences("MotionPush", Context.MODE_PRIVATE);
        String savedId = preferences.getString("installationId", null);
        installationId = MotionPushPayload.isUuid(savedId) ? savedId : UUID.randomUUID().toString();
        preferences.edit().putString("installationId", installationId).commit();
        session = new MotionPushSession(preferences.getString("bindingId", null));
        history = new MotionPushHistory(preferences.getString("history", ""), System.currentTimeMillis());
    }

    public static synchronized MotionPushState get(Context context) {
        if (instance == null) {
            instance = new MotionPushState(context);
        }
        return instance;
    }

    public synchronized String installationId() {
        return installationId;
    }

    public synchronized String bindingId() {
        return session.ticket().bindingId();
    }

    public synchronized MotionPushSession.Ticket ticket() {
        return session.ticket();
    }

    public synchronized boolean isCurrent(MotionPushSession.Ticket ticket) {
        return session.isCurrent(ticket);
    }

    public synchronized MotionPushSession.Ticket bind(String bindingId) {
        if (!bindingId.equals(bindingId())) {
            clearNotifications();
            history.clear();
        }
        MotionPushSession.Ticket ticket = session.bind(bindingId);
        preferences.edit().putString("bindingId", bindingId).remove("token").putString("history", history.saved()).commit();
        return ticket;
    }

    public synchronized boolean token(MotionPushSession.Ticket ticket, String token) {
        if (!isCurrent(ticket)) {
            return false;
        }
        preferences.edit().putString("token", token).commit();
        return true;
    }

    public synchronized void clear() {
        session.clear();
        history.clear();
        preferences.edit().remove("bindingId").remove("token").remove("history").commit();
        clearNotifications();
    }

    private void clearNotifications() {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.cancelAll();
        }
        PushNotificationsPlugin.lastMessage = null;
    }

    public synchronized boolean deliver(MotionPushPayload payload, boolean allowed, java.util.function.BooleanSupplier dispatch) {
        if (!payload.bindingId.equals(bindingId())) {
            return false;
        }
        boolean delivered = history.deliver(payload, System.currentTimeMillis(), allowed, dispatch);
        if (delivered) {
            preferences.edit().putString("history", history.saved()).commit();
        }
        return delivered;
    }
}
