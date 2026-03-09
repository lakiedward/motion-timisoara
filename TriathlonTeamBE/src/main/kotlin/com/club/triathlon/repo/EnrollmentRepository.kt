package com.club.triathlon.repo

import com.club.triathlon.domain.Child
import com.club.triathlon.domain.Enrollment
import com.club.triathlon.domain.User
import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.EnrollmentStatus
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface EnrollmentRepository : JpaRepository<Enrollment, UUID> {
    fun existsByKindAndEntityIdAndChildAndStatusIn(kind: EnrollmentKind, entityId: UUID, child: Child, statuses: Collection<EnrollmentStatus>): Boolean
    fun findByKindAndEntityIdAndChildAndStatusIn(kind: EnrollmentKind, entityId: UUID, child: Child, statuses: Collection<EnrollmentStatus>): List<Enrollment>
    fun countByKindAndEntityIdAndStatusIn(kind: EnrollmentKind, entityId: UUID, statuses: Collection<EnrollmentStatus>): Long
    fun findByKindAndEntityId(kind: EnrollmentKind, entityId: UUID): List<Enrollment>
    fun findByChildAndStatusIn(child: Child, statuses: Collection<EnrollmentStatus>): List<Enrollment>
    fun findByChild(child: Child): List<Enrollment>

    @Query("select e from Enrollment e join fetch e.child c join fetch c.parent where e.id = :id")
    fun findByIdWithChildAndParent(@Param("id") id: UUID): Enrollment?

    @Query("select e from Enrollment e join e.child c where c.parent = :parent")
    fun findByParent(@Param("parent") parent: User): List<Enrollment>

    @Query(
        """
        select e from Enrollment e
        left join Course course on e.kind = com.club.triathlon.enums.EnrollmentKind.COURSE and e.entityId = course.id
        where (:kind is null or e.kind = :kind)
          and (:status is null or e.status = :status)
          and (:coachId is null or course.coach.id = :coachId)
        """
    )
    fun findForAdmin(
        @Param("kind") kind: EnrollmentKind?,
        @Param("status") status: EnrollmentStatus?,
        @Param("coachId") coachId: UUID?
    ): List<Enrollment>

    @Query("select e from Enrollment e join fetch e.child where e.kind = :kind and e.entityId in :entityIds and e.status in :statuses")
    fun findByKindAndEntityIdInAndStatusIn(
        @Param("kind") kind: EnrollmentKind,
        @Param("entityIds") entityIds: Collection<UUID>,
        @Param("statuses") statuses: Collection<EnrollmentStatus>
    ): List<Enrollment>

    @Query(
        "select e.entityId, count(e) from Enrollment e " +
            "where e.kind = com.club.triathlon.enums.EnrollmentKind.COURSE " +
            "and e.entityId in :courseIds and e.status in :statuses " +
            "group by e.entityId"
    )
    fun countCourses(
        @Param("courseIds") courseIds: Collection<UUID>,
        @Param("statuses") statuses: Collection<EnrollmentStatus>
    ): List<Array<Any>>
}
