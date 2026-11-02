# Filtre pe Tabere, Activități și Concursuri

Data: 2026-11-02. Cerut de proprietar („Da, pe toate trei” pe cardul din thread-ul de test al paginilor publice).

## Problemă

Doar `/cursuri` avea bară de filtre (sport, zi, buget, locație). `/tabere`, `/activitati` și `/concursuri` afișau lista întreagă, fără filtre. În plus, `/concursuri` era ordonată după data creării, nu după data concursului, iar stările de eroare și listă goală nu foloseau `StatusView`.

## Soluție

- Piesele barei de la Cursuri (pastilele de sport, `FilterSelect`, butonul „mai multe filtre” de pe mobil, etichetele „Filtre active” cu „Șterge tot”) se mută în `src/components/catalog-filters/` și sunt folosite de `CourseFilters` și de noul `EventFilters`. Cursuri arată la fel ca înainte.
- `src/lib/event-catalog.ts` are logica pură: luna (în fusul București), lunile pe care le acoperă o tabără de mai multe zile, prețul în bani RON (EUR prin cursul salvat), opțiunile de lună și locație luate din date.
- Filtre pe pagină:
  - Tabere: Când? (lună), Buget (până la 500/1.000/2.000/4.000 lei), Unde?. Taberele cu preț pe categorii de vârstă nu au un singur preț, deci ies din rezultate doar când alegi un buget.
  - Activități: sport, Când?, Buget (până la 50/100/200/400 lei), Unde?.
  - Concursuri: Când?, Unde? (concursurile nu au sport sau un singur preț).
- Contor „N găsite” și o stare goală cu „Resetează filtrele”, ca la Cursuri.
- `getConcursuriPublice` ordonează după `start_at` crescător (fără dată la final).
- Concursuri folosește `StatusView` pentru eroare și listă goală și primește `data-section` pe bandă, ca celelalte liste.

## Compromisuri

- Filtrele sunt în starea paginii, nu în URL; Cursuri ține în URL doar sportul. Se poate extinde ulterior.
- Bara apare doar când lista are elemente; o listă goală păstrează mesajul ei de stare goală.
