package com.club.triathlon.service.course

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

private val mapper = ObjectMapper()

data class TimeSlot(
    val start: LocalTime,
    val end: LocalTime
)

object RecurrenceRuleParser {
    fun parse(rule: String): RecurrenceRule {
        val node: JsonNode = mapper.readTree(rule)
        
        // Check if this is the new format (daySchedules) or old format (days + start/end)
        val daySchedulesNode = node.get("daySchedules")
        
        if (daySchedulesNode != null && daySchedulesNode.isObject) {
            // New format: each day has its own time slot
            val daySchedules = mutableMapOf<Int, TimeSlot>()
            
            daySchedulesNode.fields().forEach { (dayStr, timeSlotNode) ->
                val day = dayStr.toIntOrNull() 
                    ?: throw IllegalArgumentException("Day key must be an integer between 1 and 7")
                if (day !in 1..7) {
                    throw IllegalArgumentException("Day values must be between 1 and 7")
                }
                
                val startText = timeSlotNode.get("start")?.asText()
                    ?: throw IllegalArgumentException("start is required for day $day")
                val endText = timeSlotNode.get("end")?.asText()
                    ?: throw IllegalArgumentException("end is required for day $day")
                
                val start = LocalTime.parse(startText)
                val end = LocalTime.parse(endText)
                
                if (!end.isAfter(start)) {
                    throw IllegalArgumentException("end time must be after start time for day $day")
                }
                
                daySchedules[day] = TimeSlot(start, end)
            }
            
            if (daySchedules.isEmpty()) {
                throw IllegalArgumentException("daySchedules must contain at least one day")
            }
            
            return RecurrenceRule(daySchedules = daySchedules)
        } else {
            // Old format: backward compatibility - single time for all days
            val daysNode = node.get("days") ?: throw IllegalArgumentException("days is required")
            if (!daysNode.isArray || daysNode.size() == 0) {
                throw IllegalArgumentException("days must be a non-empty array")
            }
            val days = daysNode.map { dayNode ->
                if (!dayNode.isInt) throw IllegalArgumentException("day entries must be integers")
                val value = dayNode.intValue()
                if (value !in 1..7) throw IllegalArgumentException("day values must be between 1 and 7")
                value
            }
            val startText = node.get("start")?.asText()
                ?: throw IllegalArgumentException("start is required")
            val endText = node.get("end")?.asText()
                ?: throw IllegalArgumentException("end is required")
            val start = LocalTime.parse(startText)
            val end = LocalTime.parse(endText)
            if (!end.isAfter(start)) {
                throw IllegalArgumentException("end time must be after start time")
            }
            
            // Convert old format to new format
            val daySchedules = days.associateWith { TimeSlot(start, end) }
            return RecurrenceRule(daySchedules = daySchedules)
        }
    }
}

fun RecurrenceRule.toJson(): String {
    val node = mapper.createObjectNode()
    val daySchedulesNode = node.putObject("daySchedules")
    
    daySchedules.forEach { (day, timeSlot) ->
        val timeSlotNode = daySchedulesNode.putObject(day.toString())
        timeSlotNode.put("start", timeSlot.start.toString())
        timeSlotNode.put("end", timeSlot.end.toString())
    }
    
    return mapper.writeValueAsString(node)
}

data class RecurrenceRule(
    val daySchedules: Map<Int, TimeSlot>
) {
    // Helper properties for backward compatibility
    val days: List<Int> get() = daySchedules.keys.sorted()
    
    fun getTimeSlot(day: Int): TimeSlot? = daySchedules[day]
}

data class OccurrenceRequest(
    val startDate: LocalDate,
    val weeks: Int,
    val zoneId: ZoneId = ZoneId.systemDefault()
)
