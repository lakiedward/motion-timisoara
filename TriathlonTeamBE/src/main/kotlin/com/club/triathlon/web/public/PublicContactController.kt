package com.club.triathlon.web.public

import com.club.triathlon.service.public.ContactMessageRequest
import com.club.triathlon.service.public.PublicContactService
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/public/contact")
class PublicContactController(
    private val publicContactService: PublicContactService
) {

    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    fun submitContact(@Valid @RequestBody request: ContactMessageRequest) {
        publicContactService.submitContact(request)
    }
}
