package com.club.triathlon.web

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.util.UUID

class LocationDtoTest {

    private val objectMapper = ObjectMapper()

    @Test
    fun `LocationDto serializes isActive field correctly`() {
        val dto = LocationDto(
            id = UUID.randomUUID(),
            name = "Test Location",
            city = "Test City",
            address = "Test Address",
            type = "POOL",
            lat = 1.0,
            lng = 1.0,
            description = "Test Description",
            capacity = 10,
            createdByUserId = null,
            clubId = null,
            isActive = true
        )

        val json = objectMapper.writeValueAsString(dto)

        // Should contain "isActive":true
        assertTrue(json.contains(""""isActive":true"""), "JSON should contain 'isActive' property")
        
        // Should NOT contain "active":true (unless there's another field named active, which there isn't)
        assertFalse(json.contains(""""active":true"""), "JSON should not contain 'active' property (confusing getter)")
    }
}

