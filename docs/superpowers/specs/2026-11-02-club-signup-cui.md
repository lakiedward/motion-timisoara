# Club signup with an ANAF-checked CUI (feature #625)

Status: owner decision on a card, 2026-11-02 11:55:27Z ("Nume, CUI, email, telefon"). The owner asked for the least data possible, to keep GDPR simple.

## What a club provides

- Account: administrator name, email, phone (now required), password.
- Club: name, CUI (required), city (optional), sports (optional).
- No representative, registry number, IBAN, separate club email or club phone. The club's `email` and `phone` are the account's.

## Verification

1. The form checks the CUI control digit (key 753217532) and accepts an optional `RO` prefix.
2. `register-club` asks the public ANAF VAT-payer service (`PlatitorTvaRest/v9/tva`) before creating anything.
   - Not found, deregistered (`dataRadiere` or `stare_inregistrare` RADIERE) or fiscally inactive: HTTP 422 with `CUI_NOT_FOUND`, `CUI_DEREGISTERED` or `CUI_INACTIVE`; no user or club is created.
   - Found: `company_name`, `company_address` and `company_reg_number` are filled from ANAF.
   - ANAF down, slow (8 s) or malformed: the club is still created with only `company_cui`; the admin sees "Neverificat la ANAF".
3. The club stays pending until an admin approves it (00101). `admin_clubs()` (00109) now returns phone and the company columns, shown in "De aprobat".
4. Stripe Connect stays optional and verifies the representative itself when the club enables card payments.

## Data protection

CUI, name, seat and registry number of a company or association are public registry data. For a PFA the name is the person's name, used only for the subscription invoice. The only personal data collected at signup are the account's name, email and phone.

## Not done here

- `register-club` still creates the auth user with `email_confirm: true`, as before; email confirmation is a separate decision.
- The same CUI can register more than one club; the admin sees the CUI and decides.
