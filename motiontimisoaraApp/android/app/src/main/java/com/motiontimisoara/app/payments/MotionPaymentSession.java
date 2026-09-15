package com.motiontimisoara.app.payments;

public final class MotionPaymentSession<T> {
    private T active;

    public synchronized boolean begin(T next) {
        if (active != null || next == null) {
            return false;
        }
        active = next;
        return true;
    }

    public synchronized boolean isCurrent(T candidate) {
        return active != null && active == candidate;
    }

    public synchronized T finish() {
        T previous = active;
        active = null;
        return previous;
    }
}
