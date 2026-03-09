# Privacy Policy & GDPR Compliance (DRAFT)

## 1. Data Collection & Processing

### 1.1. Audit Logging

To ensure the security and integrity of the Triathlon Team platform, we collect and store audit logs for critical system actions.

**Collected Data Points:**
- **Actor:** User ID of the person performing the action.
- **Action:** Type of operation performed (e.g., CREATE, UPDATE, DELETE).
- **Target:** Entity ID and Type affected by the action.
- **Changes:** Old and new values for specific fields (e.g., email consent).
- **Metadata:** Technical context (IP Address, timestamp).

### 1.2. IP Addresses

We collect IP addresses in audit logs for security monitoring and incident response purposes.
- **Purpose:** Fraud detection, security auditing, and preventing unauthorized access.
- **Legal Basis:** Legitimate Interest (GDPR Art. 6(1)(f)) - ensuring network and information security.
- **LIA Reference:** Our conclusion on IP collection is documented in the Legitimate Interest Assessment (LIA) [LIA-2024-001], which justifies retention for 1 year to balance security needs with user privacy. The LIA is currently **pending legal/compliance review**.
- **Validation:** We validate `X-Forwarded-For` headers against a strict list of trusted proxies. If the request comes from an untrusted source, the header is ignored, and the direct connection IP is recorded.

### 1.3. Club Public Email Consent

We provide clubs with the control to expose or hide their contact email on public endpoints.
- **Legal Basis:** Consent (GDPR Art. 6(1)(a)). The club owner explicitly opts-in.
- **Purpose:** Enabling public communication for club business.
- **Mechanism:**
  - **Consent Grant:** Club owner toggles `publicEmailConsent` to `true` via `PATCH /api/club/profile`.
  - **Consent Withdrawal:** Club owner toggles `publicEmailConsent` to `false` or calls `POST /api/club/profile/consent/withdraw`.
- **Exposure:** The `PublicClubService` exposes the email address ONLY if `publicEmailConsent` is `true`.
- **Retention:** Consent records in audit logs follow the standard 1-year retention. The current consent state is stored in the `Club` entity indefinitely until changed or the club is deleted.
- **Withdrawal Effect:** Upon withdrawal, the email is immediately removed from public API responses. An audit log entry recording the withdrawal is created.

## 2. Data Retention Policy

### 2.1. Audit Logs

- **Retention Period:** Audit logs are retained for **1 year** (365 days) from the date of creation.
- **Automatic Deletion:** Logs older than the retention period are automatically purged via `AuditLogScheduler.kt`, configurable via `app.audit.retention-days`.
- **Retention Overrides:** Legal holds or specific compliance requirements may override the standard retention period.
- **User Deletion:** If a user is deleted from the system, their ID in audit logs (`actor_user_id`) is set to `NULL` (via DB constraint `ON DELETE SET NULL` in `V38__create_audit_logs.sql`) to preserve the integrity of the system history while pseudonymizing the actor.

### 2.2 Retention Matrix

| Data Type | Retention Period | Mechanism |
|-----------|------------------|-----------|
| Audit Logs | 1 Year (365 days) | `AuditLogScheduler` (Daily Purge) |
| Consent Records | 1 Year (in Audit Logs) | `AuditLogScheduler` |
| Deleted User References | Immediate (Pseudonymization) | DB Constraint `ON DELETE SET NULL` |
| Club Profile Data | Indefinite (until deleted) | Persistent Storage |

## 3. Data Subject Rights

Users have the right to request access to their personal data, including audit logs where they are the actor.

### 3.1. Data Subject Access Requests (DSAR)

**How to Submit a Request:**
- **Email:** Send a request to `privacy@triathlonteam.com` or use the contact form in the Help Center.
- **API:** Authenticated users can submit a request via `POST /api/dsar/submit` (type: ACCESS, DELETION, RECTIFICATION).
- **Verification:** To protect your data, we require identity verification (e.g., confirming your registered email and potentially providing a government-issued ID).
- **Response Time:** We will fulfill requests within **30 days**, unless an extension is required (we will notify you if so).
- **Format:** Data will be exported in a machine-readable JSON or CSV format.
- **Escalation:** If you are unsatisfied with our response, you can escalate to our Data Protection Officer at `dpo@triathlonteam.com`.

### 3.2. Data Fulfillment for Audit Logs

When a DSAR is processed (via `DsarService.exportAuditForSubject`):
1.  **Locate Logs:** The system retrieves all logs where the `actor_user_id` matches the requesting user (`AuditService.findByActor`).
2.  **Pseudonymization:** Before export, the system applies strict pseudonymization (`DsarService.pseudonymizeAuditEntry`):
    - **Target Entities:** If the target is another user (not the requester), the `targetEntityId` is replaced with `[REDACTED]`.
    - **PII Fields:** Values in `oldValue` and `newValue` for sensitive fields (e.g., `email`, `phone`, `password`, `iban`, `card`, `address`, `ip`) are replaced with `[REDACTED]`.
    - **IP Addresses:** IP addresses in the export are `[REDACTED]` to protect network data.
3.  **Delivery:** The redacted audit trail is returned to the user.

**PII Fields Redacted:**
- Email
- Phone
- Password
- IBAN / Bank Details
- Card Information / CVV
- Postal Address
- IP Addresses
