package com.capgo.capacitor_background_geolocation;

import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

import android.app.Activity;
import android.app.Instrumentation;
import android.app.Notification;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.motiontimisoara.app.MainActivity;
import java.util.Collections;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class LiveLocationCaptureTest {
    private Instrumentation instrumentation;
    private Context context;
    private Activity activity;
    private LocationManager locations;
    private ServiceConnection connection;
    private BackgroundGeolocationService.LocalBinder binder;
    private final AtomicInteger pointCount = new AtomicInteger();
    private final AtomicReference<String> stoppedReason = new AtomicReference<>();
    private CountDownLatch stopped;
    private final LocalEvents.Listener listener = new LocalEvents.Listener() {
        @Override
        public void onLocation(String callbackId, Location location) {
            if ("synthetic-capture".equals(callbackId)) pointCount.incrementAndGet();
        }

        @Override
        public void onStopped(String callbackId, String reason) {
            if ("synthetic-capture".equals(callbackId)) {
                stoppedReason.set(reason);
                stopped.countDown();
            }
        }
    };

    @Before
    public void prepareSyntheticDevice() throws Exception {
        assumeTrue("Synthetic emulator only", Build.HARDWARE.contains("ranchu") || Build.HARDWARE.contains("goldfish"));
        instrumentation = InstrumentationRegistry.getInstrumentation();
        context = instrumentation.getTargetContext();
        shell("pm grant " + context.getPackageName() + " android.permission.ACCESS_COARSE_LOCATION");
        shell("pm grant " + context.getPackageName() + " android.permission.ACCESS_FINE_LOCATION");
        shell("pm grant " + context.getPackageName() + " android.permission.POST_NOTIFICATIONS");
        shell("appops set " + context.getPackageName() + " android:mock_location allow");
        activity = instrumentation.startActivitySync(new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        locations = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
        locations.addTestProvider(LocationManager.GPS_PROVIDER, false, false, false, false, true, true, true, 3, 1);
        locations.setTestProviderEnabled(LocationManager.GPS_PROVIDER, true);
        stopped = new CountDownLatch(1);
        LocalEvents.addListener(listener);
        CountDownLatch connected = new CountDownLatch(1);
        connection = new ServiceConnection() {
            @Override
            public void onServiceConnected(ComponentName name, IBinder service) {
                binder = (BackgroundGeolocationService.LocalBinder) service;
                connected.countDown();
            }

            @Override
            public void onServiceDisconnected(ComponentName name) {}
        };
        Intent intent = new Intent(context, BackgroundGeolocationService.class);
        context.startService(intent);
        assertTrue(context.bindService(intent, connection, Context.BIND_AUTO_CREATE));
        assertTrue("Native service binds", connected.await(10, TimeUnit.SECONDS));
    }

    private void shell(String command) throws Exception {
        try (android.os.ParcelFileDescriptor result = instrumentation.getUiAutomation().executeShellCommand(command)) {
            try (java.io.InputStream stream = new android.os.ParcelFileDescriptor.AutoCloseInputStream(result)) {
                stream.readAllBytes();
            }
        }
    }

    private void start(long duration) {
        instrumentation.runOnMainSync(() -> binder.start("synthetic-capture", "Motion synthetic test", "Synthetic location only",
            0f, null, Collections.emptyMap(), 0L, false, System.currentTimeMillis() + duration));
    }

    private void inject() {
        Location location = new Location(LocationManager.GPS_PROVIDER);
        location.setLatitude(1.25);
        location.setLongitude(2.5);
        location.setAccuracy(5);
        location.setTime(System.currentTimeMillis());
        location.setElapsedRealtimeNanos(SystemClock.elapsedRealtimeNanos());
        locations.setTestProviderLocation(LocationManager.GPS_PROVIDER, location);
    }

    private void awaitPoints(int minimum) {
        long limit = SystemClock.elapsedRealtime() + 5000;
        while (pointCount.get() < minimum && SystemClock.elapsedRealtime() < limit) {
            inject();
            SystemClock.sleep(150);
        }
        assertTrue("Receives synthetic native location", pointCount.get() >= minimum);
    }

    @Test
    public void nativeDeadlineStopsBackgroundCaptureWithoutJavascript() throws Exception {
        start(7000);
        awaitPoints(1);
        instrumentation.runOnMainSync(() -> activity.moveTaskToBack(true));
        awaitPoints(pointCount.get() + 1);
        assertTrue("Native timer expires", stopped.await(10, TimeUnit.SECONDS));
        assertEquals("CAPTURE_EXPIRED", stoppedReason.get());
        int count = pointCount.get();
        inject();
        SystemClock.sleep(1500);
        assertEquals("No updates after native expiry", count, pointCount.get());
        assertFalse("No saved watcher credentials", LocationStore.isEnabled(context));
    }

    @Test
    public void notificationStopPreventsFurtherLocations() throws Exception {
        start(30000);
        awaitPoints(1);
        instrumentation.runOnMainSync(() -> activity.moveTaskToBack(true));
        NotificationManager notifications = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        Notification.Action stopAction = null;
        for (android.service.notification.StatusBarNotification active : notifications.getActiveNotifications()) {
            if (active.getNotification().actions == null) continue;
            for (Notification.Action action : active.getNotification().actions) {
                if ("Oprește".contentEquals(action.title)) stopAction = action;
            }
        }
        assertNotNull("Persistent notification offers stop", stopAction);
        stopAction.actionIntent.send();
        assertTrue("Notification stop reaches native service", stopped.await(5, TimeUnit.SECONDS));
        assertEquals("CAPTURE_STOPPED", stoppedReason.get());
        int count = pointCount.get();
        inject();
        SystemClock.sleep(1500);
        assertEquals("No updates after stop", count, pointCount.get());
        assertFalse("No restart configuration", LocationStore.isEnabled(context));
    }

    @Test
    public void expiredStartNeverBeginsCapture() {
        AtomicReference<Exception> rejected = new AtomicReference<>();
        instrumentation.runOnMainSync(() -> {
            try {
                binder.start("synthetic-capture", "Motion synthetic test", "Synthetic only", 0f, null,
                    Collections.emptyMap(), 0L, false, System.currentTimeMillis() - 1);
            } catch (Exception exception) {
                rejected.set(exception);
            }
        });
        assertTrue(rejected.get() instanceof IllegalArgumentException);
        inject();
        SystemClock.sleep(1000);
        assertEquals(0, pointCount.get());
    }

    @After
    public void cleanSyntheticDevice() {
        LocalEvents.removeListener(listener);
        if (instrumentation != null && binder != null) instrumentation.runOnMainSync(() -> binder.stop());
        if (context != null && connection != null) context.unbindService(connection);
        if (locations != null) locations.removeTestProvider(LocationManager.GPS_PROVIDER);
        if (instrumentation != null && activity != null) instrumentation.runOnMainSync(() -> activity.finish());
    }
}
