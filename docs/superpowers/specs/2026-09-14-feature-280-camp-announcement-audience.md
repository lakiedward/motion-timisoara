# Feature #280 — Tabăra ca țintă de anunț

## Context

PR #42 a livrat anunțurile de club către întreg clubul, cursuri și activități. A exclus intenționat `CAMP`, deoarece taberele nu aveau atunci proprietar de club și politica RLS nu putea confirma că ținta aparține clubului emitent.

Migrations `00025` și `00027` au introdus ulterior `camps.club_id` și politicile care permit unui club să-și administreze taberele. Felia rămasă a feature-ului este alegerea unei tabere deținute de club ca audiență.

## Comportament

- Clubul poate alege o tabără proprie care nu s-a încheiat încă, alături de întreg clubul, cursurile și activitățile sale.
- Un anunț către tabără ajunge numai la părinții care au o înscriere activă la acea tabără.
- O tabără care nu aparține clubului nu poate fi salvată ca audiență și nici nu poate deveni vizibilă părinților.
- Anunțurile istorice către o tabără încheiată păstrează eticheta taberei; numai alegerea pentru un anunț nou exclude taberele încheiate.

## Implementare

Migrarea extinde `audience_club_id` cu `CAMP` și permite valoarea în constrângerea audienței. Politicile existente pentru citire și scriere folosesc deja funcția, astfel încât păstrează aceeași verificare de apartenență fără duplicare.

API-ul clubului citește taberele cu `club_id` propriu și le transformă în ținte. Pagina de anunțuri le grupează sub „Tabere” și le afișează pe carduri și în filtru prin eticheta „Tabără”.

## Verificare

- Teste unitare pentru includerea și excluderea taberelor în API și formular.
- Teste de componentă pentru alegere, etichetare și filtrare.
- Typecheck, lint, suită Vitest și build înainte de PR.
- Verificare în browser cu un cont CLUB și un părinte înscris la o tabără de club, fără publicare de anunțuri reale.
