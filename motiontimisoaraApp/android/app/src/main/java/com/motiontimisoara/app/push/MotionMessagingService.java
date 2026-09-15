package com.motiontimisoara.app.push;

import androidx.annotation.NonNull;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.motiontimisoara.app.MainActivity;

public class MotionMessagingService extends FirebaseMessagingService {
    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        if (remoteMessage.getNotification() != null) {
            return;
        }
        MotionPushState state = MotionPushState.get(this);
        synchronized (state) {
            MotionPushPayload payload = MotionPushPayload.parse(remoteMessage.getData(), state.bindingId(), System.currentTimeMillis());
            if (payload == null) {
                return;
            }
            state.deliver(payload, MotionPushNotifications.allowed(this), () -> {
                if (MainActivity.isForeground() && PushNotificationsPlugin.getPushNotificationsInstance() != null) {
                    RemoteMessage sanitized = new RemoteMessage.Builder("motion")
                        .setMessageId(payload.eventId)
                        .setData(payload.data())
                        .build();
                    PushNotificationsPlugin.sendRemoteMessage(sanitized);
                    return true;
                }
                return MotionPushNotifications.show(this, payload);
            });
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        MotionPushPlugin.onNewToken(this, token);
    }
}
