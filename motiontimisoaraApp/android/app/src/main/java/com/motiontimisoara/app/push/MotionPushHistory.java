package com.motiontimisoara.app.push;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.BooleanSupplier;

public final class MotionPushHistory {
    static final int LIMIT = 128;
    private final LinkedHashMap<String, Long> delivered = new LinkedHashMap<>();

    public MotionPushHistory(String saved, long now) {
        if (saved == null || saved.length() > 16000) {
            return;
        }
        for (String line : saved.split("\n")) {
            String[] fields = line.split(" ");
            if (fields.length != 2) {
                continue;
            }
            String[] identity = fields[0].split("/");
            if (identity.length != 2 || !MotionPushPayload.isUuid(identity[0]) || !MotionPushPayload.isUuid(identity[1])) {
                continue;
            }
            try {
                long expiry = Long.parseLong(fields[1]);
                if (expiry > now) {
                    delivered.put(fields[0], expiry);
                    trim();
                }
            } catch (NumberFormatException exception) {
                continue;
            }
        }
    }

    public boolean deliver(MotionPushPayload payload, long now, boolean allowed, BooleanSupplier dispatch) {
        delivered.entrySet().removeIf(entry -> entry.getValue() <= now);
        if (!allowed || payload.expiresAt <= now || delivered.containsKey(payload.historyKey()) || !dispatch.getAsBoolean()) {
            return false;
        }
        delivered.put(payload.historyKey(), payload.expiresAt);
        trim();
        return true;
    }

    private void trim() {
        while (delivered.size() > LIMIT) {
            delivered.remove(delivered.keySet().iterator().next());
        }
    }

    public void clear() {
        delivered.clear();
    }

    public String saved() {
        StringBuilder result = new StringBuilder();
        for (Map.Entry<String, Long> entry : delivered.entrySet()) {
            result.append(entry.getKey()).append(' ').append(entry.getValue()).append('\n');
        }
        return result.toString();
    }
}
