package com.motiontimisoara.app.push;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public class MotionPushSessionTest {
    @Test
    public void logoutInvalidatesPendingTokenBeforeNewAccountBinds() {
        MotionPushSession session = new MotionPushSession(null);
        MotionPushSession.Ticket previous = session.bind(MotionPushPayloadTest.BINDING);
        session.clear();
        assertFalse(session.isCurrent(previous));
        assertNull(session.ticket().bindingId());
        MotionPushSession.Ticket current = session.bind(MotionPushPayloadTest.ENTITY);
        assertFalse(session.isCurrent(previous));
        assertTrue(session.isCurrent(current));
    }

    @Test
    public void doesNotReviveAnOldRequestWhenSameBindingIsReused() {
        MotionPushSession session = new MotionPushSession(null);
        MotionPushSession.Ticket previous = session.bind(MotionPushPayloadTest.BINDING);
        session.clear();
        MotionPushSession.Ticket current = session.bind(MotionPushPayloadTest.BINDING);
        assertFalse(session.isCurrent(previous));
        assertTrue(session.isCurrent(current));
    }

    @Test
    public void restoredBindingAllowsOnlyItsCurrentGeneration() {
        MotionPushSession session = new MotionPushSession(MotionPushPayloadTest.BINDING);
        assertTrue(session.isCurrent(session.ticket()));
        assertNull(new MotionPushSession("invalid").ticket().bindingId());
    }
}
