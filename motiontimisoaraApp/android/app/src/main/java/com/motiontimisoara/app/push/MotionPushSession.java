package com.motiontimisoara.app.push;

public final class MotionPushSession {
    public record Ticket(String bindingId, long generation) {}

    private String bindingId;
    private long generation;

    public MotionPushSession(String savedBindingId) {
        bindingId = MotionPushPayload.isUuid(savedBindingId) ? savedBindingId : null;
    }

    public Ticket bind(String newBindingId) {
        if (!MotionPushPayload.isUuid(newBindingId)) {
            throw new IllegalArgumentException("Invalid push binding");
        }
        bindingId = newBindingId;
        generation++;
        return ticket();
    }

    public void clear() {
        bindingId = null;
        generation++;
    }

    public Ticket ticket() {
        return new Ticket(bindingId, generation);
    }

    public boolean isCurrent(Ticket ticket) {
        return ticket != null && bindingId != null && generation == ticket.generation() && bindingId.equals(ticket.bindingId());
    }
}
