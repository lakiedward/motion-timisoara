package com.club.triathlon.repo

import com.club.triathlon.domain.AuditLog
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import java.time.OffsetDateTime
import java.util.UUID

@Repository
interface AuditLogRepository : JpaRepository<AuditLog, UUID> {
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM AuditLog a WHERE a.timestamp < :date")
    fun deleteByTimestampBefore(date: OffsetDateTime): Int

    fun findByActorUserIdOrderByTimestampDesc(actorUserId: UUID): List<AuditLog>
    
    fun findByActorUserIdOrderByTimestampDesc(actorUserId: UUID, pageable: org.springframework.data.domain.Pageable): org.springframework.data.domain.Page<AuditLog>

    fun findByTargetEntityIdAndTargetEntityTypeOrderByTimestampDesc(
        targetEntityId: UUID, 
        targetEntityType: String
    ): List<AuditLog>

    fun findByTargetEntityIdAndTargetEntityTypeOrderByTimestampDesc(
        targetEntityId: UUID, 
        targetEntityType: String,
        pageable: org.springframework.data.domain.Pageable
    ): org.springframework.data.domain.Page<AuditLog>
}
