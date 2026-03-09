# 🌐 PUBLIC Page Patterns (Pagini Publice)

## Context

Paginile publice sunt vizibile **tuturor vizitatorilor** - focus pe atragerea clienților.

Tema: **BLUE + Accente dinamice**, design modern și atractiv.

---

## Pagini Publice

| Pagină | Path | Scop |
| :--- | :--- | :--- |
| Home | `/` | Landing page principal |
| Cursuri | `/cursuri` | Lista cursuri |
| Curs individual | `/cursuri/:id` | Detalii curs |
| Tabere | `/tabere` | Lista tabere |
| Activități | `/activitati` | Evenimente punctuale |
| Antrenori | `/antrenori` | Echipa de antrenori |
| Hartă | `/harta` | Locații antrenament |
| Despre noi | `/despre` | Informații despre club |
| Contact | `/contact` | Formular contact |

---

## Caracteristici Publice

| Element | Valoare |
| :--- | :--- |
| **Primary** | `#2563eb` (Blue) |
| **Accent** | `#f59e0b` (Amber) pentru CTA-uri |
| **Background** | White + Patterns subtile |
| **Hero** | Full-width, imagini mari |
| **CTA** | Gradient sau Amber |

---

## 1. Home Page Hero

### Structură
```html
<section class="hero">
  <div class="hero__background">
    <img src="/assets/hero-bg.jpg" alt="" />
  </div>
  <div class="hero__content">
    <h1>Building Future <span>Champions</span> 🚀</h1>
    <p>Fun, professional triathlon training for kids.</p>
    <div class="hero__cta">
      <button class="btn-cta btn-cta--primary">Join the Team</button>
      <button class="btn-cta btn-cta--outline">View Programs</button>
    </div>
    <div class="hero__stats">
      <div class="stat">
        <span class="stat__number">11</span>
        <span class="stat__label">Ani experiență</span>
      </div>
      <!-- ... more stats -->
    </div>
  </div>
</section>
```

### SCSS
```scss
.hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  overflow: hidden;
  
  &__background {
    position: absolute;
    inset: 0;
    
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.7) 50%, transparent 100%);
    }
  }
  
  &__content {
    position: relative;
    z-index: 1;
    max-width: 600px;
    padding: 2rem;
    
    h1 {
      font-family: var(--font-display);
      font-size: clamp(2.5rem, 6vw, 4rem);
      font-weight: 900;
      line-height: 1.1;
      color: var(--sport-text-dark);
      
      span {
        color: var(--sport-primary);
        font-style: italic;
      }
    }
    
    p {
      font-size: 1.25rem;
      color: var(--sport-text-muted);
      margin: 1.5rem 0 2rem;
    }
  }
  
  &__cta {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }
  
  &__stats {
    display: flex;
    gap: 2rem;
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 1px solid var(--color-border-subtle);
  }
}

.btn-cta {
  padding: 1rem 2rem;
  border-radius: var(--radius-btn);
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &--primary {
    background: var(--gradient-primary);
    color: white;
    border: none;
    box-shadow: 0 4px 20px rgba(37, 99, 235, 0.3);
    
    &:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 30px rgba(37, 99, 235, 0.4);
    }
  }
  
  &--outline {
    background: transparent;
    color: var(--sport-text-dark);
    border: 2px solid var(--color-border-subtle);
    
    &:hover {
      border-color: var(--sport-primary);
      color: var(--sport-primary);
    }
  }
}
```

---

## 2. Section Headers

### Centered (pentru secțiuni principale)
```html
<div class="section-header section-header--center">
  <span class="section-header__eyebrow">PROGRAMS</span>
  <h2 class="section-header__title">Choose Your <span>Adventure</span></h2>
  <p class="section-header__subtitle">
    Exciting training programs tailored for every stage of athletic development.
  </p>
</div>
```

### SCSS
```scss
.section-header {
  margin-bottom: 3rem;
  
  &--center {
    text-align: center;
    max-width: 700px;
    margin-left: auto;
    margin-right: auto;
  }
  
  &__eyebrow {
    display: inline-block;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--sport-accent);
    margin-bottom: 0.75rem;
  }
  
  &__title {
    font-family: var(--font-display);
    font-size: clamp(2rem, 4vw, 2.75rem);
    font-weight: 800;
    color: var(--sport-text-dark);
    margin: 0;
    letter-spacing: -0.02em;
    
    span {
      color: var(--sport-primary);
    }
  }
  
  &__subtitle {
    color: var(--sport-text-muted);
    font-size: 1.05rem;
    line-height: 1.7;
    margin: 1rem 0 0;
  }
}
```

---

## 3. Course Cards (Public)

### HTML
```html
<article class="course-card">
  <div class="course-card__image">
    <img [src]="course.imageUrl" [alt]="course.name" />
    <span class="course-card__badge" *ngIf="course.isPopular">Popular Choice</span>
    <span class="course-card__icon">🏊</span>
  </div>
  <div class="course-card__content">
    <h3>{{ course.name }}</h3>
    <p>{{ course.description }}</p>
    <div class="course-card__footer">
      <span class="course-card__price">{{ course.price }} RON/lună</span>
      <a routerLink="/cursuri/{{ course.id }}" class="course-card__link">
        Learn More →
      </a>
    </div>
  </div>
</article>
```

### SCSS
```scss
.course-card {
  background: var(--sport-bg-white);
  border-radius: var(--radius-card);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-8px);
    box-shadow: var(--shadow-card-hover);
    
    .course-card__link {
      color: var(--sport-primary);
    }
  }
  
  &__image {
    position: relative;
    aspect-ratio: 16/9;
    overflow: hidden;
    
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.5s ease;
    }
    
    &:hover img {
      transform: scale(1.05);
    }
  }
  
  &__badge {
    position: absolute;
    top: 1rem;
    left: 1rem;
    padding: 0.375rem 0.75rem;
    background: var(--gradient-warm);
    color: white;
    font-size: 0.75rem;
    font-weight: 700;
    border-radius: var(--radius-full);
  }
  
  &__icon {
    position: absolute;
    bottom: -24px;
    right: 1rem;
    width: 48px;
    height: 48px;
    background: var(--sport-bg-white);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  &__content {
    padding: 1.5rem;
    padding-top: 2rem;
    
    h3 {
      margin: 0;
      font-family: var(--font-display);
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--sport-text-dark);
    }
    
    p {
      margin: 0.5rem 0 1rem;
      color: var(--sport-text-muted);
      font-size: 0.95rem;
      line-height: 1.6;
    }
  }
  
  &__footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  &__price {
    font-weight: 700;
    color: var(--sport-primary);
  }
  
  &__link {
    color: var(--sport-text-muted);
    text-decoration: none;
    font-weight: 600;
    transition: color 0.2s ease;
  }
}
```

---

## 4. Coach Cards

```scss
.coach-card {
  text-align: center;
  padding: 2rem;
  background: var(--sport-bg-white);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-8px);
    box-shadow: var(--shadow-card-hover);
  }
  
  &__avatar {
    width: 120px;
    height: 120px;
    margin: 0 auto 1.5rem;
    border-radius: 50%;
    overflow: hidden;
    border: 4px solid var(--sport-bg-light);
    
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
  
  &__name {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sport-text-dark);
    margin: 0;
  }
  
  &__role {
    color: var(--sport-accent);
    font-weight: 600;
    font-size: 0.875rem;
    margin-top: 0.25rem;
  }
  
  &__stats {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border-subtle);
  }
}
```

---

## 5. Testimonials

```scss
.testimonial-card {
  background: var(--sport-bg-white);
  border-radius: var(--radius-card);
  padding: 2rem;
  box-shadow: var(--shadow-card);
  
  &__quote {
    font-size: 1.05rem;
    line-height: 1.7;
    color: var(--sport-text-dark);
    font-style: italic;
    
    &::before {
      content: '"';
      font-size: 3rem;
      color: var(--sport-primary);
      opacity: 0.3;
      line-height: 0;
      vertical-align: middle;
    }
  }
  
  &__author {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 1.5rem;
    
    .avatar {
      width: 48px;
      height: 48px;
    }
  }
  
  &__name {
    font-weight: 700;
    color: var(--sport-text-dark);
  }
  
  &__role {
    font-size: 0.875rem;
    color: var(--sport-text-muted);
  }
}
```

---

## 6. CTA Section (Final)

```html
<section class="cta-section">
  <div class="cta-section__content">
    <h2>Start Your Journey</h2>
    <p>Join the Motion community today and take the first step towards athletic excellence.</p>
    <button class="btn-cta btn-cta--primary">Book Assessment</button>
  </div>
</section>
```

```scss
.cta-section {
  background: var(--gradient-primary);
  padding: 5rem 2rem;
  text-align: center;
  border-radius: var(--radius-card);
  
  &__content {
    max-width: 600px;
    margin: 0 auto;
    
    h2 {
      font-family: var(--font-display);
      font-size: 2.5rem;
      font-weight: 800;
      color: white;
      margin: 0;
    }
    
    p {
      color: rgba(255, 255, 255, 0.9);
      margin: 1rem 0 2rem;
      font-size: 1.125rem;
    }
  }
  
  .btn-cta--primary {
    background: white;
    color: var(--sport-primary);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    
    &:hover {
      transform: scale(1.05);
    }
  }
}
```

---

## 7. Course Detail Page

### Hero
```scss
.course-hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  padding: 3rem 0;
  
  &__image {
    border-radius: var(--radius-card);
    overflow: hidden;
    aspect-ratio: 4/3;
    
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
  
  &__content {
    display: flex;
    flex-direction: column;
    justify-content: center;
    
    h1 {
      font-family: var(--font-display);
      font-size: 2.5rem;
      font-weight: 800;
      margin: 0;
    }
  }
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}
```

---

## 8. Mobile Adjustments

```scss
@media (max-width: 768px) {
  .hero {
    min-height: 80vh;
    
    &__content {
      padding: 1.5rem;
      
      h1 {
        font-size: 2rem;
      }
    }
    
    &__cta {
      flex-direction: column;
      
      .btn-cta {
        width: 100%;
        justify-content: center;
      }
    }
    
    &__stats {
      flex-wrap: wrap;
      gap: 1rem;
    }
  }
  
  .section-header {
    margin-bottom: 2rem;
    
    &__title {
      font-size: 1.75rem;
    }
  }
  
  .course-card {
    &__content {
      padding: 1rem;
    }
  }
}
```

---

## ✅ Checklist Pagini Publice

- [ ] Hero are imagine de fundal de calitate?
- [ ] CTA-urile sunt vizibile și atractive?
- [ ] Section headers au eyebrow + title + subtitle?
- [ ] Cardurile au hover effects?
- [ ] Testimonials sunt prezente?
- [ ] Final CTA section există?
- [ ] Responsive pe toate dimensiunile?
- [ ] Fast loading (images optimized)?
