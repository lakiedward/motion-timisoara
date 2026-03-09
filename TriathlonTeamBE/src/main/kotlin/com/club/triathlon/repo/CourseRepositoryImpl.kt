package com.club.triathlon.repo

import com.club.triathlon.domain.Course
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Repository
import java.time.OffsetDateTime
import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext

@Repository
class CourseRepositoryImpl(
    @PersistenceContext private val entityManager: EntityManager
) : CourseRepositoryCustom {

    override fun findSchedule(filter: ScheduleFilter, pageable: Pageable): Page<Course> {
        val params = mutableMapOf<String, Any>()
        val where = StringBuilder(" where 1 = 1")

        if (filter.onlyActive) {
            where.append(" and c.active = true")
        }
        filter.sport?.takeIf { it.isNotBlank() }?.let {
            where.append(" and lower(c.sport.code) = :sport")
            params["sport"] = it.lowercase()
        }
        filter.level?.takeIf { it.isNotBlank() }?.let {
            where.append(" and lower(c.level) = :level")
            params["level"] = it.lowercase()
        }
        filter.ageFrom?.let {
            where.append(" and (c.ageFrom is null or c.ageFrom <= :ageFrom)")
            params["ageFrom"] = it
        }
        filter.ageTo?.let {
            where.append(" and (c.ageTo is null or c.ageTo >= :ageTo)")
            params["ageTo"] = it
        }
        filter.locationId?.let {
            where.append(" and c.location.id = :locationId")
            params["locationId"] = it
        }
        filter.coachId?.let {
            where.append(" and c.coach.id = :coachId")
            params["coachId"] = it
        }
        filter.clubId?.let {
            where.append(" and c.club.id = :clubId")
            params["clubId"] = it
        }
        filter.dayOfWeek?.let {
            val dowValue = if (it == 7) 0 else it
            where.append(" and exists (select 1 from CourseOccurrence o where o.course = c and o.startsAt > :now and function('DATE_PART', 'dow', o.startsAt) = :dow)")
            params["now"] = OffsetDateTime.now()
            params["dow"] = dowValue.toDouble()
        }

        val select = StringBuilder("select distinct c from Course c join fetch c.coach coach join fetch c.location location join fetch c.sport sport")
        select.append(where)
        select.append(" order by c.name asc")
        val query = entityManager.createQuery(select.toString(), Course::class.java)
        params.forEach { (key, value) -> query.setParameter(key, value) }
        query.firstResult = pageable.pageNumber * pageable.pageSize
        query.maxResults = pageable.pageSize
        val content = query.resultList

        val countQueryString = StringBuilder("select count(distinct c) from Course c")
        countQueryString.append(where)
        val countQuery = entityManager.createQuery(countQueryString.toString(), Long::class.java)
        params.forEach { (key, value) -> countQuery.setParameter(key, value) }
        val total = countQuery.singleResult

        return PageImpl(content, pageable, total)
    }
}
