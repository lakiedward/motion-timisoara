package com.motiontimisoara.app.push;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

public final class MotionPushPayload {
    private static final Pattern UUID_PATTERN = Pattern.compile(
        "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
    );
    private static final Pattern CAMP_PATH = Pattern.compile("^/tabere/[a-z0-9-]{3,}$");
    private static final Pattern EXPIRY_PATTERN = Pattern.compile("^[0-9]{13}$");

    public final String eventId;
    public final String bindingId;
    public final String kind;
    public final String entityId;
    public final String path;
    public final long expiresAt;

    private MotionPushPayload(Map<String, String> data, long expiry) {
        eventId = data.get("eventId");
        bindingId = data.get("bindingId");
        kind = data.get("kind");
        entityId = data.get("entityId");
        path = data.get("path");
        expiresAt = expiry;
    }

    public static boolean isUuid(String value) {
        return value != null && UUID_PATTERN.matcher(value).matches();
    }

    public static MotionPushPayload parse(Map<String, String> data, String activeBindingId, long now) {
        if (data == null || !isUuid(activeBindingId) || !activeBindingId.equals(data.get("bindingId"))) {
            return null;
        }
        if (!isUuid(data.get("eventId")) || !isUuid(data.get("entityId")) || !validPath(data)) {
            return null;
        }
        String expiry = data.get("expiresAt");
        if (expiry == null || !EXPIRY_PATTERN.matcher(expiry).matches()) {
            return null;
        }
        try {
            long expiresAt = Long.parseLong(expiry);
            return expiresAt > now ? new MotionPushPayload(data, expiresAt) : null;
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private static boolean validPath(Map<String, String> data) {
        String kind = data.get("kind");
        String path = data.get("path");
        if (kind == null || path == null || path.length() > 2048) {
            return false;
        }
        return switch (kind) {
            case "announcement" -> path.equals("/account/announcements");
            case "attendance" -> path.equals("/account/attendance");
            case "course" -> path.equals("/cursuri/" + data.get("entityId"));
            case "camp" -> path.equals("/tabere") || CAMP_PATH.matcher(path).matches();
            default -> false;
        };
    }

    public String title() {
        return "Motion Timișoara";
    }

    public String body() {
        return switch (kind) {
            case "announcement" -> "Ai un anunț nou în Motion.";
            case "attendance" -> "Prezența a fost actualizată.";
            case "course" -> "Un curs nou este disponibil la clubul copilului tău.";
            case "camp" -> "O tabără nouă este disponibilă la clubul copilului tău.";
            default -> "Ai o actualizare în Motion.";
        };
    }

    public String historyKey() {
        return bindingId + "/" + eventId;
    }

    public Map<String, String> data() {
        Map<String, String> result = new LinkedHashMap<>();
        result.put("eventId", eventId);
        result.put("bindingId", bindingId);
        result.put("kind", kind);
        result.put("entityId", entityId);
        result.put("path", path);
        result.put("title", title());
        result.put("body", body());
        result.put("expiresAt", Long.toString(expiresAt));
        return result;
    }
}
