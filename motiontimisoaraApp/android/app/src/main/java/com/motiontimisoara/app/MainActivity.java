package com.motiontimisoara.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.motiontimisoara.app.push.MotionPushPayload;
import com.motiontimisoara.app.push.MotionPushPlugin;
import com.motiontimisoara.app.push.MotionPushState;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends BridgeActivity {
    private static volatile boolean foreground;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(MotionPushPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        foreground = true;
    }

    @Override
    public void onPause() {
        foreground = false;
        super.onPause();
    }

    public static boolean isForeground() {
        return foreground;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        if (intent != null && intent.hasExtra("google.message_id")) {
            MotionPushState state = MotionPushState.get(this);
            synchronized (state) {
                Map<String, String> data = new HashMap<>();
                for (String key : new String[] { "eventId", "bindingId", "kind", "entityId", "path", "expiresAt" }) {
                    data.put(key, intent.getStringExtra(key));
                }
                MotionPushPayload payload = MotionPushPayload.parse(data, state.bindingId(), System.currentTimeMillis());
                Bundle extras = new Bundle();
                if (payload != null) {
                    extras.putString("google.message_id", payload.eventId);
                    for (Map.Entry<String, String> item : payload.data().entrySet()) {
                        extras.putString(item.getKey(), item.getValue());
                    }
                }
                intent.replaceExtras(extras);
                super.onNewIntent(intent);
                intent.replaceExtras(new Bundle());
            }
            return;
        }
        super.onNewIntent(intent);
    }
}
