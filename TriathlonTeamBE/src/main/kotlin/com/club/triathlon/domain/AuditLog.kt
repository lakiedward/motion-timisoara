package com.club.triathlon.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.OffsetDateTime
import java.util.UUID

@Entity
@Table(name = "audit_logs")
open class AuditLog : BaseEntity() {

    @Column(name = "actor_user_id")
    var actorUserId: UUID? = null

    @Column(name = "target_entity_id", nullable = false)
    lateinit var targetEntityId: UUID

    @Column(name = "target_entity_type", nullable = false)
    lateinit var targetEntityType: String

    @Column(name = "action", nullable = false)
    lateinit var action: String

    @Column(name = "field_name")
    var fieldName: String? = null

    @Column(name = "old_value", columnDefinition = "TEXT")
    var oldValue: String? = null

    @Column(name = "new_value", columnDefinition = "TEXT")
    var newValue: String? = null

    @Column(name = "timestamp", nullable = false)
    lateinit var timestamp: OffsetDateTime

    @Column(name = "ip_address")
    var ipAddress: String? = null

    @Column(name = "metadata", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    var metadata: Map<String, Any>? = null
}
