package com.club.triathlon.repo

import com.club.triathlon.domain.CoachProfile
import com.club.triathlon.domain.User
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface CoachProfileRepository : JpaRepository<CoachProfile, UUID> {
    fun findByUserIn(users: Collection<User>): List<CoachProfile>
    fun findByUser(user: User): CoachProfile?
}
