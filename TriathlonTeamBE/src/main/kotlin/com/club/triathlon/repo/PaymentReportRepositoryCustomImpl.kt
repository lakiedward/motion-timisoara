package com.club.triathlon.repo

import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.PaymentMethod
import com.club.triathlon.enums.PaymentStatus
import com.club.triathlon.service.payment.PaymentReportRow
import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Repository
import java.time.OffsetDateTime
import java.util.UUID

@Repository
class PaymentReportRepositoryCustomImpl(
    @PersistenceContext private val entityManager: EntityManager
) : PaymentReportRepositoryCustom {

    override fun findPaymentReports(
        status: PaymentStatus?,
        method: PaymentMethod?,
        kind: EnrollmentKind?,
        coachId: UUID?,
        from: OffsetDateTime?,
        to: OffsetDateTime?,
        page: Int,
        size: Int
    ): Page<PaymentReportRow> {
        val pageable = PageRequest.of(page, size)
        val (query, params) = buildQuery(status, method, kind, coachId, from, to, paged = true)
        val typedQuery = entityManager.createQuery(query, PaymentReportRow::class.java)
        params.forEach { typedQuery.setParameter(it.key, it.value) }
        typedQuery.firstResult = pageable.pageNumber * pageable.pageSize
        typedQuery.maxResults = pageable.pageSize
        val content = typedQuery.resultList

        val countQuery = entityManager.createQuery(buildCountQuery(status, method, kind, coachId, from, to), Long::class.java)
        params.forEach { if (countQuery.parameters.any { p -> p.name == it.key }) countQuery.setParameter(it.key, it.value) }
        val total = countQuery.singleResult
        return PageImpl(content, pageable, total)
    }

    override fun findPaymentReports(
        status: PaymentStatus?,
        method: PaymentMethod?,
        kind: EnrollmentKind?,
        coachId: UUID?,
        from: OffsetDateTime?,
        to: OffsetDateTime?
    ): List<PaymentReportRow> {
        val (query, params) = buildQuery(status, method, kind, coachId, from, to, paged = false)
        val typedQuery = entityManager.createQuery(query, PaymentReportRow::class.java)
        params.forEach { typedQuery.setParameter(it.key, it.value) }
        return typedQuery.resultList
    }

    private fun buildQuery(
        status: PaymentStatus?,
        method: PaymentMethod?,
        kind: EnrollmentKind?,
        coachId: UUID?,
        from: OffsetDateTime?,
        to: OffsetDateTime?,
        paged: Boolean
    ): Pair<String, Map<String, Any>> {
        val sb = StringBuilder()
        sb.append(
            "select new com.club.triathlon.service.payment.PaymentReportRow(" +
                "child.name, parent.name, " +
                "coalesce(course.name, camp.title), " +
                "e.kind, course.coach.name, p.method, p.status, p.amount, p.createdAt, p.updatedAt, p.id, e.id, p.currency) " +
                "from Payment p " +
                "join p.enrollment e " +
                "join e.child child " +
                "join child.parent parent " +
                "left join Course course on e.kind = com.club.triathlon.enums.EnrollmentKind.COURSE and e.entityId = course.id " +
                "left join Camp camp on e.kind = com.club.triathlon.enums.EnrollmentKind.CAMP and e.entityId = camp.id " +
                "where 1=1 "
        )
        val params = mutableMapOf<String, Any>()
        status?.let { sb.append("and p.status = :status "); params["status"] = it }
        method?.let { sb.append("and p.method = :method "); params["method"] = it }
        kind?.let { sb.append("and e.kind = :kind "); params["kind"] = it }
        coachId?.let { sb.append("and course.coach.id = :coachId "); params["coachId"] = it }
        from?.let { sb.append("and p.createdAt >= :from "); params["from"] = it }
        to?.let { sb.append("and p.createdAt <= :to "); params["to"] = it }
        sb.append("order by p.createdAt desc")
        return sb.toString() to params
    }

    private fun buildCountQuery(
        status: PaymentStatus?,
        method: PaymentMethod?,
        kind: EnrollmentKind?,
        coachId: UUID?,
        from: OffsetDateTime?,
        to: OffsetDateTime?
    ): String {
        val sb = StringBuilder()
        sb.append(
            "select count(p) from Payment p " +
                "join p.enrollment e " +
                "left join Course course on e.kind = com.club.triathlon.enums.EnrollmentKind.COURSE and e.entityId = course.id " +
                "where 1=1 "
        )
        status?.let { sb.append("and p.status = :status ") }
        method?.let { sb.append("and p.method = :method ") }
        kind?.let { sb.append("and e.kind = :kind ") }
        coachId?.let { sb.append("and course.coach.id = :coachId ") }
        from?.let { sb.append("and p.createdAt >= :from ") }
        to?.let { sb.append("and p.createdAt <= :to ") }
        return sb.toString()
    }
}

