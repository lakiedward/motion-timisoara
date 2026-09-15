package com.motiontimisoara.app.push;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.assertEquals;

import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.Test;

public class MotionPushHistoryTest {
    @Test
    public void doesNotConsumeMessagesWhenPermissionIsRevoked() {
        MotionPushHistory history = new MotionPushHistory("", MotionPushPayloadTest.NOW);
        AtomicInteger displays = new AtomicInteger();
        assertFalse(history.deliver(MotionPushPayloadTest.payload(), MotionPushPayloadTest.NOW, false, () -> {
            displays.incrementAndGet();
            return true;
        }));
        assertEquals(0, displays.get());
        assertTrue(history.deliver(MotionPushPayloadTest.payload(), MotionPushPayloadTest.NOW, true, () -> true));
    }

    @Test
    public void failedDisplayRemainsRetryableAndSuccessfulDisplayDeduplicates() {
        MotionPushHistory history = new MotionPushHistory("", MotionPushPayloadTest.NOW);
        assertFalse(history.deliver(MotionPushPayloadTest.payload(), MotionPushPayloadTest.NOW, true, () -> false));
        assertTrue(history.deliver(MotionPushPayloadTest.payload(), MotionPushPayloadTest.NOW, true, () -> true));
        assertFalse(history.deliver(MotionPushPayloadTest.payload(), MotionPushPayloadTest.NOW, true, () -> true));
    }

    @Test
    public void survivesProcessRestartAndSeparatesBindings() {
        MotionPushHistory history = new MotionPushHistory("", MotionPushPayloadTest.NOW);
        assertTrue(history.deliver(MotionPushPayloadTest.payload(), MotionPushPayloadTest.NOW, true, () -> true));
        MotionPushHistory restored = new MotionPushHistory(history.saved(), MotionPushPayloadTest.NOW);
        assertFalse(restored.deliver(MotionPushPayloadTest.payload(), MotionPushPayloadTest.NOW, true, () -> true));
        Map<String, String> otherBinding = MotionPushPayloadTest.data("announcement", "/account/announcements");
        otherBinding.put("bindingId", MotionPushPayloadTest.ENTITY);
        MotionPushPayload payload = MotionPushPayload.parse(otherBinding, MotionPushPayloadTest.ENTITY, MotionPushPayloadTest.NOW);
        assertTrue(restored.deliver(payload, MotionPushPayloadTest.NOW, true, () -> true));
    }

    @Test
    public void boundsPersistentHistoryTo128RecentEvents() {
        MotionPushHistory history = new MotionPushHistory("invalid saved data\n", MotionPushPayloadTest.NOW);
        for (int index = 0; index < 200; index++) {
            Map<String, String> data = MotionPushPayloadTest.data("announcement", "/account/announcements");
            data.put("eventId", String.format("20000000-0000-4000-8000-%012d", index));
            MotionPushPayload payload = MotionPushPayload.parse(data, MotionPushPayloadTest.BINDING, MotionPushPayloadTest.NOW);
            assertTrue(history.deliver(payload, MotionPushPayloadTest.NOW, true, () -> true));
        }
        assertEquals(128, history.saved().split("\n").length);
        MotionPushHistory restored = new MotionPushHistory(history.saved(), MotionPushPayloadTest.NOW + 60000);
        assertEquals("", restored.saved());
    }

    @Test
    public void ignoresCorruptSavedEntriesAndClearsOnUnbinding() {
        String key = MotionPushPayloadTest.BINDING + "/" + MotionPushPayloadTest.EVENT;
        MotionPushHistory history = new MotionPushHistory(key + " NaN\n" + key + " 1\n../invalid 1900000000000", MotionPushPayloadTest.NOW);
        assertEquals("", history.saved());
        assertTrue(history.deliver(MotionPushPayloadTest.payload(), MotionPushPayloadTest.NOW, true, () -> true));
        history.clear();
        assertEquals("", history.saved());
    }
}
