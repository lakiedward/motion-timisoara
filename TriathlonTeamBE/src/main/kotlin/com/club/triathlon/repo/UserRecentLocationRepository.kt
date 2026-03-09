package com.club.triathlon.repo

import com.club.triathlon.domain.UserRecentLocation
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface UserRecentLocationRepository : JpaRepository<UserRecentLocation, UUID> {
    
    // Find user's recent locations ordered by last used (most recent first)
    @Query("""
        SELECT url FROM UserRecentLocation url 
        JOIN FETCH url.location l 
        WHERE url.user.id = :userId AND l.isActive = true
        ORDER BY url.lastUsedAt DESC
    """)
    fun findByUserIdOrderByLastUsedDesc(userId: UUID): List<UserRecentLocation>
    
    // Find user's recent locations for a specific city
    @Query("""
        SELECT url FROM UserRecentLocation url 
        JOIN FETCH url.location l 
        WHERE url.user.id = :userId 
        AND l.isActive = true 
        AND LOWER(l.city) = LOWER(:city)
        ORDER BY url.lastUsedAt DESC
    """)
    fun findByUserIdAndCityOrderByLastUsedDesc(userId: UUID, city: String): List<UserRecentLocation>
    
    // Find existing record for user + location combination
    fun findByUserIdAndLocationId(userId: UUID, locationId: UUID): UserRecentLocation?
    
    // Delete old records - this will be handled in service layer
    // JPQL doesn't support LIMIT in subqueries, so we handle cleanup programmatically
    fun findByUserIdOrderByLastUsedAtAsc(userId: UUID): List<UserRecentLocation>
    
    // Delete all records for a specific location (used when deleting a location)
    fun deleteByLocationId(locationId: UUID)
    
    // Delete all records for a specific user (used when deleting a user)
    fun deleteByUser(user: com.club.triathlon.domain.User)
}
