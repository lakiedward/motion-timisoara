package com.club.triathlon.repo

import com.club.triathlon.domain.Enrollment
import com.club.triathlon.domain.Payment
import com.club.triathlon.enums.PaymentMethod
import com.club.triathlon.enums.PaymentStatus
import com.club.triathlon.service.payment.PaymentReportRow
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface PaymentRepository : JpaRepository<Payment, UUID>, PaymentReportRepositoryCustom {
    fun findByEnrollmentIn(enrollments: Collection<Enrollment>): List<Payment>
    fun findByEnrollment(enrollment: Enrollment): List<Payment>

    @Query("select p from Payment p where p.enrollment.id = :enrollmentId")
    fun findByEnrollmentId(@Param("enrollmentId") enrollmentId: UUID): Payment?

    @Query(
        "select new com.club.triathlon.service.payment.PaymentReportRow(" +
            "child.name, parent.name, " +
            "course.name, " +
            "e.kind, course.coach.name, p.method, p.status, p.amount, p.createdAt, p.updatedAt, p.id, e.id, p.currency) " +
            "from Payment p " +
            "join p.enrollment e " +
            "join e.child child " +
            "join child.parent parent " +
            "join Course course on e.kind = com.club.triathlon.enums.EnrollmentKind.COURSE and e.entityId = course.id " +
            "where course.club.id = :clubId " +
            "and p.status = :status " +
            "and p.method = :method " +
            "order by p.createdAt desc"
    )
    fun findClubPaymentReports(
        @Param("clubId") clubId: UUID,
        @Param("status") status: PaymentStatus,
        @Param("method") method: PaymentMethod
    ): List<PaymentReportRow>
}
