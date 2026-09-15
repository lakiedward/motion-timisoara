package com.motiontimisoara.app.push;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.Test;

public class MotionPushReplyTest {
    private static final class Timer implements MotionPushReply.Scheduler {
        private Runnable action;
        private long delayMillis;
        private boolean cancelled;

        public MotionPushReply.Cancellation schedule(Runnable scheduled, long delay) {
            action = scheduled;
            delayMillis = delay;
            return () -> cancelled = true;
        }

        private void fire() {
            action.run();
        }
    }

    @Test
    public void deadlineRepliesOnceAndSuppressesLateSuccess() {
        Timer timer = new Timer();
        AtomicInteger rejected = new AtomicInteger();
        AtomicInteger resolved = new AtomicInteger();
        MotionPushReply reply = new MotionPushReply(timer, 5_000, rejected::incrementAndGet);
        assertEquals(5_000, timer.delayMillis);
        timer.fire();
        assertFalse(reply.pending());
        assertFalse(reply.complete(resolved::incrementAndGet));
        timer.fire();
        assertEquals(1, rejected.get());
        assertEquals(0, resolved.get());
    }

    @Test
    public void completedReplyCancelsItsTimerAndCannotLaterClearBinding() {
        Timer timer = new Timer();
        MotionPushSession session = new MotionPushSession(null);
        MotionPushSession.Ticket ticket = session.bind(MotionPushPayloadTest.BINDING);
        MotionPushReply reply = new MotionPushReply(timer, 15_000, session::clear);
        assertTrue(reply.complete(() -> {}));
        assertTrue(timer.cancelled);
        timer.fire();
        assertTrue(session.isCurrent(ticket));
    }

    @Test
    public void oldConfigureDeadlineCannotClearNewerBinding() {
        Timer timer = new Timer();
        MotionPushSession session = new MotionPushSession(null);
        MotionPushSession.Ticket previous = session.bind(MotionPushPayloadTest.BINDING);
        new MotionPushReply(timer, 15_000, () -> {
            if (session.isCurrent(previous)) {
                session.clear();
            }
        });
        MotionPushSession.Ticket current = session.bind(MotionPushPayloadTest.ENTITY);
        timer.fire();
        assertTrue(session.isCurrent(current));
        assertFalse(session.isCurrent(previous));
    }

    @Test
    public void responseDeadlineDoesNotReleaseSerializedOperationBeforeActualCompletion() throws Exception {
        ExecutorService operations = Executors.newSingleThreadExecutor();
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch actualCompletion = new CountDownLatch(1);
        Timer timer = new Timer();
        AtomicInteger lateSuccess = new AtomicInteger();
        MotionPushReply reply = new MotionPushReply(timer, 5_000, () -> {});
        try {
            Future<?> deletion = operations.submit(() -> {
                started.countDown();
                try {
                    actualCompletion.await();
                    reply.complete(lateSuccess::incrementAndGet);
                } catch (InterruptedException exception) {
                    throw new AssertionError(exception);
                }
            });
            Future<?> nextConfiguration = operations.submit(() -> {});
            assertTrue(started.await(1, TimeUnit.SECONDS));
            timer.fire();
            assertFalse(reply.pending());
            assertFalse(deletion.isDone());
            assertFalse(nextConfiguration.isDone());
            actualCompletion.countDown();
            deletion.get(1, TimeUnit.SECONDS);
            nextConfiguration.get(1, TimeUnit.SECONDS);
            assertEquals(0, lateSuccess.get());
        } finally {
            actualCompletion.countDown();
            operations.shutdownNow();
        }
    }

    @Test
    public void queuedConfigureExpiresWithoutActivatingAfterPreviousOperationFinishes() throws Exception {
        ExecutorService operations = Executors.newSingleThreadExecutor();
        CountDownLatch blocked = new CountDownLatch(1);
        Timer timer = new Timer();
        AtomicInteger activated = new AtomicInteger();
        MotionPushReply reply = new MotionPushReply(timer, 15_000, () -> {});
        try {
            operations.submit(() -> {
                try {
                    blocked.await();
                } catch (InterruptedException exception) {
                    throw new AssertionError(exception);
                }
            });
            Future<?> configure = operations.submit(() -> {
                if (reply.pending()) {
                    reply.complete(activated::incrementAndGet);
                }
            });
            timer.fire();
            assertEquals(15_000, timer.delayMillis);
            blocked.countDown();
            configure.get(1, TimeUnit.SECONDS);
            assertEquals(0, activated.get());
        } finally {
            blocked.countDown();
            operations.shutdownNow();
        }
    }
}
