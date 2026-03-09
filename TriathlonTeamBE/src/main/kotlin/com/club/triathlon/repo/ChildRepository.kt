package com.club.triathlon.repo

import com.club.triathlon.domain.Child
import com.club.triathlon.domain.User
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface ChildRepository : JpaRepository<Child, UUID> {
    fun findAllByParent(parent: User): List<Child>
}
