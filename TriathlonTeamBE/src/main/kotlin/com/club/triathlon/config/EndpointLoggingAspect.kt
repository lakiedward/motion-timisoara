package com.club.triathlon.config

import org.aspectj.lang.ProceedingJoinPoint
import org.aspectj.lang.reflect.MethodSignature
import org.aspectj.lang.annotation.Around
import org.aspectj.lang.annotation.Aspect
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.web.bind.annotation.*

@Aspect
@Component
class EndpointLoggingAspect {
    
    private val logger = LoggerFactory.getLogger(EndpointLoggingAspect::class.java)
    
    @Around("@annotation(org.springframework.web.bind.annotation.GetMapping) || " +
            "@annotation(org.springframework.web.bind.annotation.PostMapping) || " +
            "@annotation(org.springframework.web.bind.annotation.PutMapping) || " +
            "@annotation(org.springframework.web.bind.annotation.PatchMapping) || " +
            "@annotation(org.springframework.web.bind.annotation.DeleteMapping)")
    fun logEndpointExecution(joinPoint: ProceedingJoinPoint): Any? {
        val methodName = joinPoint.signature.name
        val className = joinPoint.target.javaClass.simpleName
        val httpMethod = getHttpMethod(joinPoint)
        
        logger.info("🎯 [ENDPOINT] $httpMethod ${className}.${methodName}() - Starting execution")
        
        return try {
            val result = joinPoint.proceed()
            logger.info("✅ [ENDPOINT] $httpMethod ${className}.${methodName}() - Completed successfully")
            result
        } catch (ex: Exception) {
            logger.error("❌ [ENDPOINT] $httpMethod ${className}.${methodName}() - Failed with error: ${ex.message}")
            throw ex
        }
    }
    
    private fun getHttpMethod(joinPoint: ProceedingJoinPoint): String {
        val method = (joinPoint.signature as? MethodSignature)?.method
            ?: return "UNKNOWN"

        return when {
            method.isAnnotationPresent(GetMapping::class.java) -> "GET"
            method.isAnnotationPresent(PostMapping::class.java) -> "POST"
            method.isAnnotationPresent(PutMapping::class.java) -> "PUT"
            method.isAnnotationPresent(PatchMapping::class.java) -> "PATCH"
            method.isAnnotationPresent(DeleteMapping::class.java) -> "DELETE"
            else -> "UNKNOWN"
        }
    }
}