package com.motiontimisoara.app.push;

import android.Manifest;
import android.content.Context;
import android.os.Build;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.google.android.gms.tasks.Tasks;
import com.google.android.gms.tasks.Task;
import com.google.firebase.messaging.FirebaseMessaging;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "MotionPush",
    permissions = @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "receive")
)
public class MotionPushPlugin extends Plugin {
    private static final ExecutorService TOKEN_OPERATIONS = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "motion-push-token");
        thread.setDaemon(true);
        return thread;
    });
    private static final ScheduledExecutorService REPLY_DEADLINES = Executors.newSingleThreadScheduledExecutor(runnable -> {
        Thread thread = new Thread(runnable, "motion-push-deadline");
        thread.setDaemon(true);
        return thread;
    });
    private static final MotionPushReply.Scheduler REPLY_SCHEDULER = (action, delayMillis) -> {
        java.util.concurrent.ScheduledFuture<?> future = REPLY_DEADLINES.schedule(action, delayMillis, TimeUnit.MILLISECONDS);
        return () -> future.cancel(false);
    };

    @Override
    public void load() {
        MotionPushNotifications.createChannel(getContext());
    }

    @PluginMethod
    public void configure(PluginCall call) {
        String bindingId = call.getString("bindingId");
        if (!MotionPushPayload.isUuid(bindingId)) {
            call.reject("Legătura notificărilor nu este validă.", "INVALID_BINDING");
            return;
        }
        if (!MotionPushNotifications.allowed(getContext())) {
            call.reject("Permite notificările pentru a le activa.", "PERMISSION_DENIED");
            return;
        }
        MotionPushState state = MotionPushState.get(getContext());
        synchronized (state) {
            MotionPushSession.Ticket ticket = state.bind(bindingId);
            MotionPushReply reply = new MotionPushReply(REPLY_SCHEDULER, 15_000, () -> {
                synchronized (state) {
                    if (state.isCurrent(ticket)) {
                        state.clear();
                    }
                }
                call.reject("Notificările nu au putut fi activate. Reîncearcă.", "TOKEN_UNAVAILABLE");
            });
            TOKEN_OPERATIONS.execute(() -> configureToken(call, reply, state, ticket));
        }
    }

    private void configureToken(PluginCall call, MotionPushReply reply, MotionPushState state, MotionPushSession.Ticket ticket) {
        if (!reply.pending()) {
            return;
        }
        if (!state.isCurrent(ticket)) {
            reply.complete(() -> call.reject("Activarea notificărilor a fost anulată.", "BINDING_CHANGED"));
            return;
        }
        try {
            FirebaseMessaging messaging = FirebaseMessaging.getInstance();
            messaging.setAutoInitEnabled(true);
            String token = awaitCompletion(messaging.getToken());
            synchronized (state) {
                if (!state.isCurrent(ticket)) {
                    reply.complete(() -> call.reject("Activarea notificărilor a fost anulată.", "BINDING_CHANGED"));
                    return;
                }
                if (!MotionPushNotifications.allowed(getContext())) {
                    reply.complete(() -> {
                        state.clear();
                        call.reject("Permisiunea pentru notificări a fost retrasă.", "PERMISSION_DENIED");
                    });
                    return;
                }
                if (token == null || token.isEmpty()) {
                    reply.complete(() -> {
                        state.clear();
                        call.reject("Notificările nu au putut fi activate. Reîncearcă.", "TOKEN_UNAVAILABLE");
                    });
                    return;
                }
                reply.complete(() -> {
                    state.token(ticket, token);
                    JSObject result = new JSObject();
                    result.put("installationId", state.installationId());
                    result.put("token", token);
                    result.put("bindingId", ticket.bindingId());
                    call.resolve(result);
                });
            }
        } catch (Exception exception) {
            synchronized (state) {
                reply.complete(() -> {
                    if (state.isCurrent(ticket)) {
                        state.clear();
                    }
                    call.reject("Notificările nu au putut fi activate. Reîncearcă.", "TOKEN_UNAVAILABLE");
                });
            }
        }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        MotionPushState state = MotionPushState.get(getContext());
        synchronized (state) {
            state.clear();
            MotionPushReply reply = new MotionPushReply(REPLY_SCHEDULER, 5_000, () ->
                call.reject("Notificările sunt oprite pe telefon; ștergerea înregistrării trebuie reîncercată.", "TOKEN_DELETE_FAILED")
            );
            TOKEN_OPERATIONS.execute(() -> {
                try {
                    FirebaseMessaging messaging = FirebaseMessaging.getInstance();
                    messaging.setAutoInitEnabled(false);
                    awaitCompletion(messaging.deleteToken());
                    reply.complete(call::resolve);
                } catch (Exception exception) {
                    reply.complete(() -> call.reject("Notificările sunt oprite pe telefon; ștergerea înregistrării trebuie reîncercată.", "TOKEN_DELETE_FAILED"));
                }
            });
        }
    }

    private static <T> T awaitCompletion(Task<T> task) throws ExecutionException {
        boolean interrupted = false;
        try {
            while (true) {
                try {
                    return Tasks.await(task);
                } catch (InterruptedException exception) {
                    interrupted = true;
                }
            }
        } finally {
            if (interrupted) {
                Thread.currentThread().interrupt();
            }
        }
    }

    @PluginMethod
    public void status(PluginCall call) {
        MotionPushState state = MotionPushState.get(getContext());
        synchronized (state) {
            JSObject result = new JSObject();
            result.put("installationId", state.installationId());
            result.put("bindingId", state.bindingId() == null ? JSONObject.NULL : state.bindingId());
            result.put("permission", permission());
            call.resolve(result);
        }
    }

    private String permission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            PermissionState permission = getPermissionState("receive");
            if (permission != PermissionState.GRANTED) {
                return permission == PermissionState.PROMPT ? "prompt" : "denied";
            }
        }
        return MotionPushNotifications.allowed(getContext()) ? "granted" : "denied";
    }

    public static void onNewToken(Context context, String token) {
        MotionPushState state = MotionPushState.get(context);
        synchronized (state) {
            MotionPushSession.Ticket ticket = state.ticket();
            if (state.isCurrent(ticket)) {
                TOKEN_OPERATIONS.execute(() -> refreshToken(state, ticket, token));
            }
        }
    }

    private static void refreshToken(MotionPushState state, MotionPushSession.Ticket ticket, String announcedToken) {
        if (!state.isCurrent(ticket)) {
            return;
        }
        try {
            String currentToken = awaitCompletion(FirebaseMessaging.getInstance().getToken());
            synchronized (state) {
                if (currentToken != null && currentToken.equals(announcedToken) && state.token(ticket, currentToken)) {
                    PushNotificationsPlugin.onNewToken(currentToken);
                }
            }
        } catch (Exception exception) {
            synchronized (state) {
                PushNotificationsPlugin plugin = PushNotificationsPlugin.getPushNotificationsInstance();
                if (state.isCurrent(ticket) && plugin != null) {
                    plugin.sendError("Înregistrarea notificărilor trebuie reîncercată.");
                }
            }
        }
    }
}
