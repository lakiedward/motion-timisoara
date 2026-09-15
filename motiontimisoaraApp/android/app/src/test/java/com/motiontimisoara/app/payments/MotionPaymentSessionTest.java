package com.motiontimisoara.app.payments;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.Test;

public class MotionPaymentSessionTest {
    @Test
    public void simultaneousConfirmationsKeepOnlyOnePendingCall() throws Exception {
        MotionPaymentSession<Object> session = new MotionPaymentSession<>();
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger accepted = new AtomicInteger();
        Runnable confirm = () -> {
            ready.countDown();
            try {
                start.await();
                if (session.begin(new Object())) {
                    accepted.incrementAndGet();
                }
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            }
        };
        Thread first = new Thread(confirm);
        Thread second = new Thread(confirm);
        first.start();
        second.start();
        ready.await();
        start.countDown();
        first.join();
        second.join();
        assertTrue(accepted.get() == 1);
    }

    @Test
    public void lateReadinessCannotPresentAfterDestructionOrReplaceANewCall() {
        MotionPaymentSession<Object> session = new MotionPaymentSession<>();
        Object abandoned = new Object();
        Object retry = new Object();
        assertTrue(session.begin(abandoned));
        assertSame(abandoned, session.finish());
        assertTrue(session.begin(retry));
        assertFalse(session.isCurrent(abandoned));
        assertTrue(session.isCurrent(retry));
        assertSame(retry, session.finish());
        assertNull(session.finish());
    }
}
