package com.club.triathlon.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Table

@Entity
@Table(name = "sports")
open class Sport : BaseEntity() {

    @Column(name = "code", nullable = false, unique = true, length = 50)
    lateinit var code: String

    @Column(name = "name", nullable = false)
    lateinit var name: String
}



