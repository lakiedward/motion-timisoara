package com.motiontimisoara.app.push;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertFalse;

import java.util.HashMap;
import java.util.Map;
import org.junit.Test;

public class MotionPushPayloadTest {
    static final long NOW = 1800000000000L;
    static final String BINDING = "10000000-0000-4000-8000-000000000001";
    static final String ENTITY = "10000000-0000-4000-8000-000000000002";
    static final String EVENT = "10000000-0000-4000-8000-000000000003";

    static Map<String, String> data(String kind, String path) {
        Map<String, String> result = new HashMap<>();
        result.put("eventId", EVENT);
        result.put("bindingId", BINDING);
        result.put("entityId", ENTITY);
        result.put("kind", kind);
        result.put("path", path);
        result.put("expiresAt", Long.toString(NOW + 60000));
        return result;
    }

    static MotionPushPayload payload() {
        return MotionPushPayload.parse(data("announcement", "/account/announcements"), BINDING, NOW);
    }

    @Test
    public void acceptsAllSupportedDestinations() {
        assertNotNull(payload());
        assertNotNull(MotionPushPayload.parse(data("attendance", "/account/attendance"), BINDING, NOW));
        assertNotNull(MotionPushPayload.parse(data("course", "/cursuri/" + ENTITY), BINDING, NOW));
        assertNotNull(MotionPushPayload.parse(data("camp", "/tabere/inot--2026-"), BINDING, NOW));
        assertNotNull(MotionPushPayload.parse(data("camp", "/tabere"), BINDING, NOW));
    }

    @Test
    public void rejectsAbsentAndPreviousAccountBindings() {
        Map<String, String> data = data("announcement", "/account/announcements");
        assertNull(MotionPushPayload.parse(data, null, NOW));
        assertNull(MotionPushPayload.parse(data, ENTITY, NOW));
        data.remove("bindingId");
        assertNull(MotionPushPayload.parse(data, BINDING, NOW));
    }

    @Test
    public void requiresFullCanonicalIdentifiers() {
        Map<String, String> data = data("announcement", "/account/announcements");
        for (String field : new String[] { "eventId", "entityId" }) {
            for (String invalid : new String[] { "1-1-1-1-1", "../parent", "", "10000000-0000-4000-8000-000000000003x" }) {
                Map<String, String> changed = new HashMap<>(data);
                changed.put(field, invalid);
                assertNull(MotionPushPayload.parse(changed, BINDING, NOW));
            }
        }
    }

    @Test
    public void rejectsExpiredAndMalformedExpiry() {
        Map<String, String> data = data("announcement", "/account/announcements");
        for (String expiry : new String[] { "1800000000", "NaN", "1800000000001.5", "-1800000000000", Long.toString(NOW), Long.toString(NOW - 1) }) {
            data.put("expiresAt", expiry);
            assertNull(MotionPushPayload.parse(data, BINDING, NOW));
        }
        data.remove("expiresAt");
        assertNull(MotionPushPayload.parse(data, BINDING, NOW));
    }

    @Test
    public void refusesArbitraryUrlsAndMismatchedEntities() {
        for (String path : new String[] { "https://motiontimisoara.com/account/announcements", "//evil.example", "/account/announcements?next=/admin", "/account/announcements#details", "/account/attendance", "/admin" }) {
            assertNull(MotionPushPayload.parse(data("announcement", path), BINDING, NOW));
        }
        assertNull(MotionPushPayload.parse(data("course", "/cursuri/" + EVENT), BINDING, NOW));
        assertNull(MotionPushPayload.parse(data("camp", "/tabere/../admin"), BINDING, NOW));
        assertNull(MotionPushPayload.parse(data("camp", "/tabere/camp%2Fadmin"), BINDING, NOW));
        assertNull(MotionPushPayload.parse(data("payment", "/account"), BINDING, NOW));
    }

    @Test
    public void discardsMessageTextAndUnknownFields() {
        Map<String, String> data = data("announcement", "/account/announcements");
        data.put("title", "Private child name");
        data.put("body", "Private attendance details");
        data.put("secret", "Must never reach JS");
        MotionPushPayload payload = MotionPushPayload.parse(data, BINDING, NOW);
        assertNotNull(payload);
        assertEquals("Motion Timișoara", payload.data().get("title"));
        assertEquals("Ai un anunț nou în Motion.", payload.data().get("body"));
        assertFalse(payload.data().containsKey("secret"));
    }
}
