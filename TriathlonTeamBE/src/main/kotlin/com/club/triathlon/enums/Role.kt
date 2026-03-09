package com.club.triathlon.enums

enum class Role {
    ADMIN,      // Super-admin: gestionează toate cluburile și antrenorii platformei
    CLUB,       // Club owner: gestionează antrenorii proprii, Stripe Connect pentru facturare
    COACH,      // Antrenor: se asociază la cluburi prin cod unic
    PARENT      // Părinte/User: înscrie copiii la cursuri
}