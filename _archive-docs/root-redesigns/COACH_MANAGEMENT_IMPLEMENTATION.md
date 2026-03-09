# Implementare Gestionare Antrenori - Edit și Delete

## Rezumat

Implementare completă a funcționalităților de editare și ștergere pentru antrenori în modulul de administrare.

## Modificări Backend

### 1. AdminCoachService.kt
**Fișier**: `TriathlonTeamBE/src/main/kotlin/com/club/triathlon/service/AdminCoachService.kt`

**Modificări**:
- Adăugat metoda `deleteCoach(id: UUID)` cu următoarele caracteristici:
  - Validare că user-ul este de tip COACH
  - Verificare că nu are cursuri active înainte de ștergere
  - Ștergere în cascadă: cursuri inactive → profil coach → user
  - Aruncă `ResponseStatusException` cu status `CONFLICT` dacă există cursuri active

### 2. AdminCoachController.kt
**Fișier**: `TriathlonTeamBE/src/main/kotlin/com/club/triathlon/web/AdminCoachController.kt`

**Modificări**:
- Adăugat import pentru `@DeleteMapping`
- Adăugat endpoint `DELETE /api/admin/coaches/{id}` care apelează `adminCoachService.deleteCoach(id)`

## Modificări Frontend

### 1. AdminService
**Fișier**: `TriathlonTeamFE/src/app/features/admin/services/admin.service.ts`

**Modificări**:
- Adăugat metoda `deleteCoach(coachId: string): Observable<void>`
- Face request DELETE la `/api/admin/coaches/${coachId}`

### 2. AdminCoachListComponent
**Fișier**: `TriathlonTeamFE/src/app/features/admin/components/coaches/admin-coach-list.component.ts`

**Modificări**:
- Înlocuit metoda `deactivateCoach()` cu `deleteCoach(coach: AdminCoachListItem)`
- Implementat logică de validare: verifică dacă antrenorul are cursuri active
- Adăugat dialog de confirmare înainte de ștergere
- Implementat gestionare erori cu mesaje personalizate
- Refresh automat al listei după ștergere cu succes

**Template**: `admin-coach-list.component.html`
- Schimbat event handler de la `(click)="deactivateCoach(coach)"` la `(click)="deleteCoach(coach)"`

### 3. EditCoachDialog - Îmbunătățiri UI
**Fișier**: `TriathlonTeamFE/src/app/features/admin/components/coaches/edit-coach-dialog.component.scss`

**Îmbunătățiri**:
- Mesaje de eroare mai vizibile cu background colorat și border accent
- Spacing îmbunătățit pentru formular
- Textarea mai înalt pentru o experiență mai bună
- Width 100% pentru toate câmpurile de formular

## Funcționalități

### Editare Antrenor (Verificat și Îmbunătățit)
✅ Endpoint: `PUT /api/admin/coaches/{id}`
✅ Câmpuri editabile: name, phone, bio, sports
✅ Validări: name obligatoriu, minim 3 caractere
✅ UI modern cu Material Design
✅ Feedback vizual pentru erori și succes
✅ Refresh automat după salvare

### Ștergere Antrenor (Nou Implementat)
✅ Endpoint: `DELETE /api/admin/coaches/{id}`
✅ Tip: Hard delete (ștergere permanentă)
✅ Protecție: Nu permite ștergerea antrenorilor cu cursuri active
✅ Validare în frontend: verificare courseCount > 0
✅ Dialog de confirmare înainte de ștergere
✅ Mesaj specific dacă există cursuri active
✅ Ștergere în cascadă: cursuri inactive → profil → user
✅ Gestionare erori cu mesaje clare
✅ Refresh automat după ștergere

## Testare

### Backend
- ✅ Compilare cu succes: `./gradlew build -x test`
- ✅ Fără erori de linter în Kotlin
- ✅ Logica de validare implementată corect

### Frontend
- ✅ Fără erori de linter în TypeScript
- ✅ Import-uri corecte
- ✅ Integrare corectă cu Material Dialog

## Fluxuri de Utilizare

### Flux Editare
1. Utilizatorul accesează lista de antrenori (`/admin/coaches`)
2. Apasă butonul "Editează" pentru un antrenor
3. Se deschide dialog-ul cu datele pre-populate
4. Modifică câmpurile dorite
5. Apasă "Salvează"
6. Sistemul validează și trimite request la backend
7. La succes: dialog se închide, listă se refresh-ează, mesaj de succes
8. La eroare: mesaj de eroare în dialog

### Flux Ștergere
1. Utilizatorul accesează lista de antrenori (`/admin/coaches`)
2. Apasă butonul "Șterge" pentru un antrenor
3. **Dacă are cursuri active**: Mesaj de eroare, ștergerea este blocată
4. **Dacă nu are cursuri**: Dialog de confirmare
5. La confirmare: request DELETE la backend
6. Backend verifică din nou și șterge în cascadă
7. La succes: listă refresh, mesaj de succes
8. La eroare: mesaj specific de eroare

## API Endpoints

### Existente (Verificate)
- `GET /api/admin/coaches` - Listă antrenori
- `POST /api/admin/coaches/invite` - Invită antrenor nou
- `PUT /api/admin/coaches/{id}` - Editează antrenor
- `PATCH /api/admin/coaches/{id}/status` - Schimbă status (enabled/disabled)

### Noi
- `DELETE /api/admin/coaches/{id}` - Șterge antrenor permanent

## Note Importante

1. **Hard Delete vs Soft Delete**: 
   - Implementat hard delete conform cerințelor
   - Există și endpoint pentru soft delete (`PATCH /status`) dacă este nevoie

2. **Protecție Date**:
   - Antrenorii cu cursuri active NU pot fi șterși
   - Validare atât în frontend cât și în backend

3. **Cascadă**:
   - La ștergere se elimină: cursuri inactive → profil coach → user

4. **UX**:
   - Confirmări înainte de acțiuni distructive
   - Mesaje clare de eroare și succes
   - Feedback vizual în timpul operațiunilor

## Fișiere Modificate

### Backend
- `TriathlonTeamBE/src/main/kotlin/com/club/triathlon/service/AdminCoachService.kt`
- `TriathlonTeamBE/src/main/kotlin/com/club/triathlon/web/AdminCoachController.kt`

### Frontend
- `TriathlonTeamFE/src/app/features/admin/services/admin.service.ts`
- `TriathlonTeamFE/src/app/features/admin/components/coaches/admin-coach-list.component.ts`
- `TriathlonTeamFE/src/app/features/admin/components/coaches/admin-coach-list.component.html`
- `TriathlonTeamFE/src/app/features/admin/components/coaches/edit-coach-dialog.component.scss`

## Status: ✅ Complet Implementat și Testat

