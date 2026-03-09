package com.example.demo

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.ConfigurationPropertiesScan
import io.swagger.v3.oas.annotations.OpenAPIDefinition
import io.swagger.v3.oas.annotations.info.Info
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.boot.runApplication
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.scheduling.annotation.EnableScheduling

import org.springframework.context.annotation.Bean
import java.time.Clock

@SpringBootApplication(scanBasePackages = ["com.example.demo", "com.club.triathlon"])
@ConfigurationPropertiesScan(basePackages = ["com.club.triathlon.config"])
@EntityScan(basePackages = ["com.example.demo", "com.club.triathlon.domain"])
@EnableJpaRepositories(basePackages = ["com.example.demo", "com.club.triathlon.repo"])
@EnableScheduling
@OpenAPIDefinition(info = Info(title = "Triathlon Club API", version = "v1"))
class TriathlonTeamBeApplication {
    @Bean
    fun clock(): Clock = Clock.systemUTC()
}

fun main(args: Array<String>) {
    runApplication<TriathlonTeamBeApplication>(*args)
}

