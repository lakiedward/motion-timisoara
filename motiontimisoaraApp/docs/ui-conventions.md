# Convenții UI — motiontimisoaraApp

<!-- GENERAT de scripts/ui-conventions.mjs. Nu edita de mână: `npm run conventions`
     îl rescrie, iar src/ui-conventions.test.ts se înroșește dacă cifrele de aici
     nu sunt cele măsurate din cod. -->

Citește-l înainte de a scrie criteriile unei secțiuni noi: ce e mai jos se
moștenește, nu se re-decide. Ce nu e mai jos e chiar nou și merită o întrebare.

6 convenții · 3 respectate · 2 în derivă · 1 fără canonic

## Stare de eroare ≠ listă goală  [DERIVĂ 28/51]

    Orice ecran care încarcă date are trei ieșiri distincte: așteptare,
    eroare cu reîncercare, gol. Nu cad una peste alta — o listă goală
    nu poate fi cum arată o rețea căzută.

    canonic  src/features/camps/CampsListPage.tsx
    plafon   28 ecrane fără ramură de eroare, din 51 — poate doar scădea

## Țintă tactilă  [FĂRĂ CANONIC]

    Niciun control sub ținta comună; se urmează tokenul, nu numărul.
    Cât timp tokenul nu există, asta NU e o convenție — e un item de lucru.

    canonic  — lipsește —
    măsurat  62 valori scrise de mână, în 24 fișiere
    →        unde trăiește tokenul e o alegere, nu o măsurătoare. Deschis pe Focus.

## Forme de așteptare  [RESPECTATĂ]

    Scheletul oglindește structura pe care o promite; nu se scrie local.

    canonic  src/components/ui/skeleton.tsx
    blocat   0 animate-pulse în afara primitivei
    folosit  34 fișiere

## Culorile de brand  [DERIVĂ 1]

    Nicio culoare literală în componente; totul prin tokeni, ambele teme.

    canonic   src/index.css :root + .dark
    plafon    1 literal hex rămas, în 1 fișier — poate doar scădea
              src/features/public/CourseDetailsPage.tsx (1)
    excepție  src/features/auth/GoogleSignInButton.tsx — culorile oficiale ale logoului Google — marca altcuiva, nu se tokenizează

## Contrast pe perechile de tokeni  [RESPECTATĂ]

    Orice pereche <token> / <token>-foreground trece pragul AA: ≥ 4,5:1.
    Când o pereche cade, culoarea rămâne vie și se închide cerneala — aceleași
    culori sunt folosite și ca text pe fundal închis, deci închiderea lor le stinge.

    canonic  src/index.css — perechile <token> / <token>-foreground
             --accent / --accent-foreground — 6.16:1
             --card / --card-foreground — 17.85:1
             --highlight / --highlight-foreground — 8.31:1
             --muted / --muted-foreground — 4.55:1
             --popover / --popover-foreground — 17.85:1
             --primary / --primary-foreground — 5.17:1
             --secondary / --secondary-foreground — 16.30:1
             --sidebar / --sidebar-foreground — 17.06:1
             --sidebar-accent / --sidebar-accent-foreground — 6.16:1
             --sidebar-primary / --sidebar-primary-foreground — 5.17:1
             --success / --success-foreground — 7.83:1

## Fus orar la „încheiat"  [RESPECTATĂ]

    Sfârșitul zilei în fusul CITITORULUI, filtrat în JS. Niciodată gte/lte pe
    o coloană de dată în interogare — taie după miezul nopții UTC și ascunde
    un rând cu o zi mai devreme pentru cine e la vest de Greenwich.

    canonic  src/api/camps.ts sAIncheiat()
    blocat   0 filtre de dată în interogări
    folosit  2 fișiere
