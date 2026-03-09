package com.club.triathlon.service.course

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import java.time.LocalTime

class RecurrenceRuleParserTest {

    @Test
    fun `parse valid rule - old format`() {
        val json = """{"days":[2,4],"start":"18:00","end":"19:30"}"""
        val rule = RecurrenceRuleParser.parse(json)
        assertEquals(listOf(2, 4), rule.days)
        assertEquals(LocalTime.of(18, 0), rule.getTimeSlot(2)?.start)
        assertEquals(LocalTime.of(19, 30), rule.getTimeSlot(2)?.end)
        assertEquals(LocalTime.of(18, 0), rule.getTimeSlot(4)?.start)
        assertEquals(LocalTime.of(19, 30), rule.getTimeSlot(4)?.end)
    }
    
    @Test
    fun `parse valid rule - new format with different times per day`() {
        val json = """{"daySchedules":{"2":{"start":"18:00","end":"19:30"},"4":{"start":"16:00","end":"17:00"}}}"""
        val rule = RecurrenceRuleParser.parse(json)
        assertEquals(listOf(2, 4), rule.days)
        assertEquals(LocalTime.of(18, 0), rule.getTimeSlot(2)?.start)
        assertEquals(LocalTime.of(19, 30), rule.getTimeSlot(2)?.end)
        assertEquals(LocalTime.of(16, 0), rule.getTimeSlot(4)?.start)
        assertEquals(LocalTime.of(17, 0), rule.getTimeSlot(4)?.end)
    }

    @Test
    fun `invalid day throws`() {
        val json = """{"days":[0],"start":"18:00","end":"19:30"}"""
        assertThrows(IllegalArgumentException::class.java) {
            RecurrenceRuleParser.parse(json)
        }
    }

    @Test
    fun `end before start throws`() {
        val json = """{"days":[2],"start":"19:00","end":"18:00"}"""
        assertThrows(IllegalArgumentException::class.java) {
            RecurrenceRuleParser.parse(json)
        }
    }
}