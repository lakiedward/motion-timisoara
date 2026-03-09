package com.club.triathlon.repo

import com.club.triathlon.domain.Location
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface LocationRepository : JpaRepository<Location, UUID> {
    
    // Legacy club-specific queries (kept for backwards compatibility)
    @Query("SELECT l FROM Location l WHERE l.club.id = :clubId ORDER BY l.name")
    fun findByClubId(clubId: UUID): List<Location>
    
    @Query("SELECT l FROM Location l WHERE l.club.id = :clubId AND l.id = :locationId")
    fun findByClubIdAndId(clubId: UUID, locationId: UUID): Location?
    
    @Query("SELECT COUNT(l) FROM Location l WHERE l.club.id = :clubId AND l.isActive = true")
    fun countActiveByClubId(clubId: UUID): Long
    
    // ============================================
    // Shared Locations System - New Queries
    // ============================================
    
    // Find all active locations
    @Query("SELECT l FROM Location l WHERE l.isActive = true ORDER BY l.name")
    fun findAllActive(): List<Location>
    
    // Find active locations by city (case-insensitive)
    @Query("SELECT l FROM Location l WHERE l.isActive = true AND LOWER(l.city) = LOWER(:city) ORDER BY l.name")
    fun findActiveByCityIgnoreCase(city: String): List<Location>
    
    // Search locations by name or address (case-insensitive, partial match)
    @Query("""
        SELECT l FROM Location l 
        WHERE l.isActive = true 
        AND (LOWER(l.name) LIKE LOWER(CONCAT('%', :query, '%')) 
             OR LOWER(l.address) LIKE LOWER(CONCAT('%', :query, '%')))
        ORDER BY l.name
    """)
    fun searchByNameOrAddress(query: String): List<Location>
    
    // Search locations by name/address within a specific city
    @Query("""
        SELECT l FROM Location l 
        WHERE l.isActive = true 
        AND LOWER(l.city) = LOWER(:city)
        AND (LOWER(l.name) LIKE LOWER(CONCAT('%', :query, '%')) 
             OR LOWER(l.address) LIKE LOWER(CONCAT('%', :query, '%')))
        ORDER BY l.name
    """)
    fun searchByCityAndQuery(city: String, query: String): List<Location>
    
    // Get distinct cities that have active locations
    @Query("SELECT DISTINCT l.city FROM Location l WHERE l.isActive = true AND l.city IS NOT NULL ORDER BY l.city")
    fun findDistinctCities(): List<String>
    
    // Check if a similar location exists (for deduplication suggestions)
    @Query("""
        SELECT l FROM Location l 
        WHERE l.isActive = true 
        AND LOWER(l.city) = LOWER(:city)
        AND LOWER(l.name) LIKE LOWER(CONCAT('%', :name, '%'))
    """)
    fun findSimilarLocations(city: String, name: String): List<Location>

    @Query(
        value = """
            SELECT * FROM locations l
            WHERE lower(btrim(regexp_replace(coalesce(l.city, ''), '\s+', ' ', 'g'))) = :cityNorm
              AND lower(btrim(regexp_replace(l.name, '\s+', ' ', 'g'))) = :nameNorm
              AND lower(btrim(regexp_replace(coalesce(l.address, ''), '\s+', ' ', 'g'))) = :addressNorm
            LIMIT 1
        """,
        nativeQuery = true
    )
    fun findFirstByNormalizedCityNameAddress(
        cityNorm: String,
        nameNorm: String,
        addressNorm: String
    ): Location?
}