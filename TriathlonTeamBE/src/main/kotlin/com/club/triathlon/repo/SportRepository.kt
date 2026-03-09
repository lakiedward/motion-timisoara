package com.club.triathlon.repo

import com.club.triathlon.domain.Sport
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.util.Optional
import java.util.UUID

@Repository
interface SportRepository : JpaRepository<Sport, UUID> {
    fun findByCode(code: String): Optional<Sport>
    fun findAllByOrderByNameAsc(): List<Sport>
    fun existsByCode(code: String): Boolean
}



