package com.club.triathlon.repo

import com.club.triathlon.domain.Camp
import org.springframework.data.jpa.repository.JpaRepository
import java.util.Optional
import java.util.UUID

interface CampRepository : JpaRepository<Camp, UUID> {
    fun findBySlug(slug: String): Optional<Camp>
    fun existsBySlug(slug: String): Boolean
    fun findAllByOrderByPeriodStartAsc(): List<Camp>
}

