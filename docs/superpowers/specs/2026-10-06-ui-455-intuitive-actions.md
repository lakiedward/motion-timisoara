# UI Coverage #455: intuitive Codes actions

The admin Codes page keeps its existing heading and workflow order: direct coach creation, then invitation codes. Two canonical Cards explain the workflows. Direct creation makes an independent coach account and exposes a temporary password for the administrator to share. Invitation codes let a coach create their own account.

Both forms start closed behind explicit disclosure buttons. Inputs stay mounted, with their values and validation state retained across collapse. Opening focuses the first field; closing returns focus to the disclosure button. A pending backend action disables collapse. Successful results stay visible outside each collapsed form, including the last successful coach credentials after a later failed attempt.

The invitation list is immediately visible. Every row shows its status, current and maximum uses, and either its expiration instant in the local timezone or the absence of expiration. Copy is a labeled row action. Success and failure feedback appears by the relevant copy action, without global notifications. Generation success and clipboard success remain separate. Automatic copy runs after successful generation, never extends generation's pending state, and a stale copy completion cannot update a newer result.

Existing validation, duplicate-submit guards, loading, error/retry, empty states, backend access and account contracts remain unchanged. No live backend writes are part of the UI verification. The design reuses canonical Card, Button, Input, Label, Badge and Skeleton components and semantic tokens for both themes.

Focused unit tests cover disclosure, focus, retained state, clipboard outcomes and pending-operation regressions. Browser verification at 375x812, 768x1024 and 1440x900 remains required. Final human UI acceptance is pending; this proposal does not create accepted tracker criteria or pass human gates.
