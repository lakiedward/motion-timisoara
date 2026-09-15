package com.motiontimisoara.app.push;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

public final class MotionPushReply {
    public interface Cancellation {
        void cancel();
    }

    public interface Scheduler {
        Cancellation schedule(Runnable action, long delayMillis);
    }

    private final AtomicBoolean answered = new AtomicBoolean();
    private final AtomicReference<Cancellation> deadline = new AtomicReference<>();

    public MotionPushReply(Scheduler scheduler, long delayMillis, Runnable expired) {
        Cancellation scheduled = scheduler.schedule(() -> complete(expired), delayMillis);
        deadline.set(scheduled);
        if (answered.get()) {
            scheduled.cancel();
        }
    }

    public boolean pending() {
        return !answered.get();
    }

    public boolean complete(Runnable response) {
        if (!answered.compareAndSet(false, true)) {
            return false;
        }
        Cancellation scheduled = deadline.get();
        if (scheduled != null) {
            scheduled.cancel();
        }
        response.run();
        return true;
    }
}
