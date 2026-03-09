package com.example.demo.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Configuration
import org.springframework.web.servlet.config.annotation.CorsRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

@Configuration
class CorsConfig(
    @Value("\${app.cors.allowed-origins}") private val allowedOrigins: String
) : WebMvcConfigurer {

    override fun addCorsMappings(registry: CorsRegistry) {
        val origins = allowedOrigins.split(",")
            .map { it.trim() }
            .filter { it.isNotEmpty() }

        registry.addMapping("/**")
            .apply {
                if (origins.isNotEmpty()) {
                    allowedOrigins(*origins.toTypedArray())
                } else {
                    allowedOriginPatterns("*")
                }
            }
            .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            .allowedHeaders("*")
            .allowCredentials(true)
    }
}
