import {
  DecimalPipe,
  NgFor,
  NgIf,
  isPlatformBrowser,
  NgOptimizedImage
} from '@angular/common';
import { Component, PLATFORM_ID, inject, ViewChild, ElementRef, AfterViewInit, OnDestroy, HostListener, OnInit, DestroyRef } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, map, finalize } from 'rxjs/operators';
import {
  CampSummary,
  CoachSummary,
  PagedResponse,
  ProgramCourse,
  PublicApiService,
  PublicSport,
  SportType
} from '../../../core/services/public-api.service';
import { SkeletonLoaderComponent } from '../../../shared/components/skeleton-loader/skeleton-loader.component';
import { TooltipDirective } from '../../../shared/tooltip.directive';
import { NotificationService } from '../../../core/services/notification.service';

interface HeroMetric {
  value: string;
  label: string;
}

interface ProgramCard {
  title: string;
  description: string;
  image: string;
  ageRange: string;
  link: string;
  accent: 'blue' | 'indigo' | 'cyan' | 'purple';
  categoryIcon: string;
  categoryLabel: string;
  popularityTag?: 'popular' | 'nou';
}

interface ResultHighlight {
  value: string;
  label: string;
  description: string;
  accent: 'blue' | 'indigo' | 'cyan' | 'purple';
  icon: string;
  animatedIcon?: string; // Emoji/animated icon
  numericValue?: number;
  suffix?: string;
}

interface MomentCard {
  title: string;
  description: string;
  image: string;
  location?: string;
  date?: string;
  tags?: string[];
  categoryIcon?: string;
  popularityTag?: 'popular' | 'nou' | 'recent';
  accent?: 'blue' | 'indigo' | 'cyan' | 'purple';
}

interface StaffMember {
  name: string;
  role: string;
  experience: string;
  specialty: string;
}

interface ActivityCard {
  icon: string;
  title: string;
  description: string;
  image: string;
  badge?: string;
  badgeColor?: 'blue' | 'emerald' | 'amber' | 'cyan';
}

interface GalleryPhoto {
  src: string;
  category: string;
  caption: string;
  accent: 'blue' | 'indigo' | 'cyan' | 'purple';
}

interface TestimonialCard {
  quote: string;
  name: string;
  role: string;
  avatar?: string;
  rating: number;
  date: string;
  verified: boolean;
}

interface TrainingSessionCard {
  id: string;
  title: string;
  sport: PublicSport | SportType | string;
  startTime: string;
  endTime?: string;
  coachName?: string;
  locationName?: string;
  image: string;
  description: string;
  sportLabel: string;
  icon: string;
  heroPhotoUrl?: string;
}

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    RouterLink,
    DecimalPipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    FormsModule,
    SkeletonLoaderComponent,
    NgOptimizedImage
  ],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('600ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('staggerFade', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(30px)' }),
          stagger('100ms', [
            animate('500ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ]),
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-50px)' }),
        animate('800ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ])
    ])
  ]
})
export class HomePageComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly publicApi = inject(PublicApiService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  // Custom cursor eliminat pentru designul Revolut-style
  private animationFrameId: number | null = null;
  private intersectionObserver?: IntersectionObserver;
  private parallaxElements: HTMLElement[] = [];
  scrollProgress = 0;
  loadingPrograms = true;
  isHeroScrolled = false;

  // Mobile carousel refs/state
  @ViewChild('mobileTrack') mobileTrackRef?: ElementRef<HTMLDivElement>;
  mobileActiveIndex = 0;
  private mobileScrollRaf?: number;

  constructor() {
    // Initialize with fallback data for SSR to avoid empty content on server render
    if (!this.isBrowser) {
      this.programs.set(this.fallbackPrograms.slice(0, 3));
      this.isLoadingPrograms.set(false);
      this.isLoadingCoaches.set(false);
    }
  }

  ngOnInit(): void {
    // Only load from API in browser to avoid server-side request loops
    if (this.isBrowser) {
      this.loadPrograms();
      this.loadCoaches();
    }
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      this.setupScrollReveal();
      this.initParallax();
      this.initCounterAnimations();

      // Simulate loading programs data
      setTimeout(() => {
        this.loadingPrograms = false;
      }, 1500);

      // Re-observe elements after async content loads
      setTimeout(() => {
        this.refreshScrollReveal();
      }, 500);

      // Another check after potential data loading
      setTimeout(() => {
        this.refreshScrollReveal();
      }, 2000);

      // Ensure images are visible after a delay (fallback for load event issues)
      setTimeout(() => {
        const trainingImages = document.querySelectorAll('.training-card__media img');
        trainingImages.forEach(img => {
          const imgElement = img as HTMLImageElement;
          if (!imgElement.classList.contains('loaded') && imgElement.complete && imgElement.naturalWidth > 0) {
            imgElement.classList.add('loaded');
            console.log('Fallback: Added loaded class to image:', imgElement.src);
          }
        });
      }, 3000);

      // Init mobile carousel indicator updates after view is ready
      if (this.mobileTrackRef) {
        const track = this.mobileTrackRef.nativeElement;
        track.addEventListener('scroll', this.handleMobileTrackScroll, { passive: true });
        // Initial computation
        setTimeout(() => this.computeMobileActiveIndex(), 0);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    if (this.newsletterResetTimeout) {
      clearTimeout(this.newsletterResetTimeout);
      this.newsletterResetTimeout = undefined;
    }
    this.clearConfettiElements();

    // Cleanup mobile carousel listeners/raf
    if (this.mobileTrackRef) {
      this.mobileTrackRef.nativeElement.removeEventListener('scroll', this.handleMobileTrackScroll as EventListener);
    }
    if (this.mobileScrollRaf) {
      cancelAnimationFrame(this.mobileScrollRaf);
      this.mobileScrollRaf = undefined;
    }
  }

  // Custom cursor methods eliminat pentru designul Revolut-style

  // ============================================
  // SCROLL REVEAL
  // ============================================
  private initScrollReveal(): void {
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      const observerOptions: IntersectionObserverInit = {
        threshold: 0.05,
        rootMargin: '0px 0px -20px 0px'
      };

      this.intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');

            // Initialize counters when results section comes in view
            if (entry.target.classList.contains('home-results') && !this.countersInitialized) {
              this.startCounterAnimations();
              this.countersInitialized = true;
            }

            // Optionally unobserve after revealing (one-time animation)
            // this.intersectionObserver?.unobserve(entry.target);
          }
        });
      }, observerOptions);

      // Observe all elements with scroll-reveal class
      const revealElements = document.querySelectorAll('.scroll-reveal');
      revealElements.forEach(el => {
        // Check if element is already in viewport
        const rect = el.getBoundingClientRect();
        const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;

        if (isInViewport) {
          // Reveal immediately if already visible
          el.classList.add('revealed');

          // Initialize counters if results section is visible
          if (el.classList.contains('home-results') && !this.countersInitialized) {
            this.startCounterAnimations();
            this.countersInitialized = true;
          }
        }

        this.intersectionObserver?.observe(el);
      });
    }, 100);
  }

  private refreshScrollReveal(): void {
    if (!this.isBrowser || !this.intersectionObserver) return;

    const revealElements = document.querySelectorAll('.scroll-reveal:not(.revealed)');
    revealElements.forEach(el => {
      // Check if element is already in viewport
      const rect = el.getBoundingClientRect();
      const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;

      if (isInViewport) {
        // Reveal immediately if already visible
        el.classList.add('revealed');
      }

      // Make sure it's being observed
      this.intersectionObserver?.observe(el);
    });
  }

  // ============================================
  // PARALLAX EFFECT
  // ============================================
  private initParallax(): void {
    this.parallaxElements = Array.from(document.querySelectorAll('[data-parallax]'));

    if (this.parallaxElements.length > 0) {
      window.addEventListener('scroll', this.handleParallaxScroll.bind(this), { passive: true });
    }
  }

  @HostListener('window:scroll')
  handleParallaxScroll(): void {
    if (!this.isBrowser) return;

    const scrollY = window.scrollY;
    const documentElement = document.documentElement;
    const maxScroll = documentElement.scrollHeight - window.innerHeight;

    if (maxScroll > 0) {
      this.scrollProgress = Math.min(100, Math.max(0, (scrollY / maxScroll) * 100));
    } else {
      this.scrollProgress = 0;
    }

    // Hero scroll detection - trigger animation when scrolled past hero
    const heroSection = document.querySelector('.hero-revolut');
    if (heroSection) {
      const heroRect = heroSection.getBoundingClientRect();
      this.isHeroScrolled = scrollY > 100; // Trigger after 100px scroll
    }

    if (this.parallaxElements.length === 0) return;

    this.parallaxElements.forEach(element => {
      const rect = element.getBoundingClientRect();
      const elementTop = rect.top + scrollY;
      const elementHeight = rect.height;
      const viewportHeight = window.innerHeight;

      // Only apply parallax when element is in viewport
      if (rect.top < viewportHeight && rect.bottom > 0) {
        const speed = parseFloat(element.getAttribute('data-parallax') || '0.5');
        const yPos = (scrollY - elementTop) * speed;

        element.style.setProperty('--parallax-y', `${yPos}px`);

        // For images inside parallax containers
        const img = element.querySelector('img');
        if (img) {
          (img as HTMLElement).style.transform = `translateY(${yPos}px)`;
        }
      }
    });
  }

  readonly heroMetrics: HeroMetric[] = [
    { value: '3+', label: 'ani de programe multisport' },
    { value: '50+', label: 'familii implicate anual' },
    { value: '6', label: 'ore ghidate / săptămână' }
  ];

  readonly heroHighlights: string[] = [
    'Înot, ciclism și alergare într-un cadru sigur',
    'Antrenori cu experiență dedicați copiilor',
    'Tabere tematice și evaluări periodice'
  ];

  // Dark mode removed; always light theme

  readonly fallbackPrograms: ProgramCard[] = [
    {
      title: 'Sporturi Acvatice Copii',
      description: 'Pentru copiii de 6-12 ani: înot, jocuri acvatice și activități de bazin într-un mediu distractiv și sigur',
      image: '/ui/pool-kids-team.jpg',
      ageRange: '6-12 ani',
      link: '/cursuri',
      accent: 'blue',
      categoryIcon: '🏊',
      categoryLabel: 'Înot',
      popularityTag: 'popular'
    },
    {
      title: 'Antrenamente Multisport Juniori',
      description: 'Pentru tinerii de 13-17 ani: ciclism, alergare, fitness și alte sporturi cu focus pe performanță și dezvoltare',
      image: '/ui/DSC_1419.JPG',
      ageRange: '13-17 ani',
      link: '/cursuri',
      accent: 'indigo',
      categoryIcon: '🏃',
      categoryLabel: 'Multisport',
      popularityTag: 'nou'
    },
    {
      title: 'Tabere de Bicicletă',
      description: 'Aventuri pe două roți: MTB, cicloturism și tehnici avansate de pedalare în natură',
      image: '/ui/IMG-20210817-WA0040.jpg',
      ageRange: '8-16 ani',
      link: '/tabere',
      accent: 'cyan',
      categoryIcon: '🚴',
      categoryLabel: 'Ciclism',
      popularityTag: 'popular'
    },
    {
      title: 'Tabere de Ski',
      description: 'Experiențe pe zăpadă: ski alpin, tehnici de coborâre și siguranță montană',
      image: '/ui/IMG_20250220_113246.jpg',
      ageRange: '8-16 ani',
      link: '/tabere',
      accent: 'purple',
      categoryIcon: '⛷️',
      categoryLabel: 'Ski',
      popularityTag: 'nou'
    }
  ];

  // Fetch programs from API - display max 3 courses
  readonly programs = signal<ProgramCard[]>([]);
  readonly isLoadingPrograms = signal(false);

  readonly resultHighlights: ResultHighlight[] = [
    {
      value: '11',
      label: 'Ani experiență',
      description: 'Echipa noastră de antrenori certificați cu experiență vastă în lucrul cu tinerii',
      accent: 'blue',
      icon: 'schedule',
      animatedIcon: '🎯',
      numericValue: 11,
      suffix: ''
    },
    {
      value: '150+',
      label: 'Copii Antrenați',
      description: 'Comunitatea noastră în creștere de sportivi entuziaști și dedicați',
      accent: 'indigo',
      icon: 'emoji_people',
      animatedIcon: '👥',
      numericValue: 150,
      suffix: '+'
    },
    {
      value: '10+',
      label: 'Programe Active',
      description: 'Varietate de activități sportive pentru fiecare vârstă și nivel',
      accent: 'cyan',
      icon: 'timer',
      animatedIcon: '🏆',
      numericValue: 10,
      suffix: '+'
    },
    {
      value: '∞',
      label: 'Beneficii',
      description: 'Dezvoltare personală prin sport, disciplină și prietenii pentru viață',
      accent: 'purple',
      icon: 'trending_up',
      animatedIcon: '✨'
    }
  ];

  // Counter animations
  animatedValues: number[] = [];
  countersInitialized = false;

  // Lightbox state
  showLightbox = false;
  currentImageIndex = 0;
  imageLoading = false;

  readonly galleryPhotos: GalleryPhoto[] = [
    {
      src: '/ui/pool-kids-team.jpg',
      category: 'Înot',
      caption: 'Antrenamente de înot pentru copii',
      accent: 'blue'
    },
    {
      src: '/ui/img-20210817-wa0040.jpg',
      category: 'Ciclism',
      caption: 'Aventuri pe bicicletă în natură',
      accent: 'cyan'
    },
    {
      src: '/ui/img_20250220_113246.jpg',
      category: 'Ski',
      caption: 'Tabere de ski pe pârtie',
      accent: 'purple'
    },
    {
      src: '/ui/img-20190807-wa0037.jpg',
      category: 'Echipă',
      caption: 'Spirit de echipă și prietenii',
      accent: 'indigo'
    },
    {
      src: '/ui/img_20240619_104545.jpg',
      category: 'Înot',
      caption: 'Perfecționarea tehnicii de înot',
      accent: 'blue'
    },
    {
      src: '/ui/img-20210817-wa0046.jpg',
      category: 'Ciclism',
      caption: 'Tabere de ciclism montan',
      accent: 'cyan'
    },
    {
      src: '/ui/img_20231130_112543.jpg',
      category: 'Activități',
      caption: 'Momente de bucurie și joacă',
      accent: 'indigo'
    },
    {
      src: '/ui/img-20190806-wa0023.jpg',
      category: 'Ciclism',
      caption: 'Tehnici de pedalare și siguranță',
      accent: 'cyan'
    }
  ];

  readonly moments: MomentCard[] = [
    {
      title: 'Antrenamente de înot',
      description: 'Sesiuni intensive la piscină pentru perfecționarea tehnicii de crawl',
      image: '/ui/swim-training-coach.jpg',
      location: 'Piscina Delfinul',
      date: 'Vară 2024',
      tags: ['înot', 'antrenament', 'tehnică'],
      categoryIcon: '🏊',
      popularityTag: 'popular',
      accent: 'blue'
    },
    {
      title: 'Spirit de echipă',
      description: 'Construirea prieteniilor și a încrederii prin activități de grup',
      image: '/ui/IMG-20190807-WA0037.jpg',
      location: 'Centrul Sportiv Politehnica',
      date: 'Iulie 2024',
      tags: ['echipa', 'jocuri', 'prietenie'],
      categoryIcon: '🤝',
      popularityTag: 'nou',
      accent: 'indigo'
    },
    {
      title: 'Tabere de ciclism',
      description: 'Aventuri pe bicicletă în peisaje montane spectaculoase',
      image: '/ui/IMG-20210817-WA0046.jpg',
      location: 'Munții Apuseni',
      date: 'Aug 2024',
      tags: ['bicicletă', 'tabăra', 'montan'],
      categoryIcon: '🚴',
      popularityTag: 'popular',
      accent: 'cyan'
    },
    {
      title: 'Aventuri în aer liber',
      description: 'Explorare montană, drumeții și activități outdoor pentru copii',
      image: '/ui/IMG-20210817-WA0025.jpg',
      location: 'Munții Banatului',
      date: 'Iun 2024',
      tags: ['aer liber', 'drumeție', 'explorare'],
      categoryIcon: '🏔️',
      popularityTag: 'recent',
      accent: 'purple'
    },
    {
      title: 'Experiențe pe zăpadă',
      description: 'Tabere de ski pentru dezvoltarea abilităților de iarnă',
      image: '/ui/IMG_20190216_114358.jpg',
      location: 'Stațiunea Râșnov',
      date: 'Feb 2024',
      tags: ['ski', 'zăpadă', 'iarnă'],
      categoryIcon: '⛷️',
      popularityTag: 'recent',
      accent: 'cyan'
    }
  ];

  // Fetch coaches from API
  readonly coaches = signal<CoachSummary[]>([]);
  readonly isLoadingCoaches = signal(false);

  readonly activities: ActivityCard[] = [
    {
      icon: 'pool',
      title: 'Înot și Sporturi Acvatice',
      description: 'Tehnici de crawl, jocuri acvatice, îmbunătățirea rezistenței și activități de bazin',
      image: '',
      badge: 'Tot anul',
      badgeColor: 'blue'
    },
    {
      icon: 'directions_bike',
      title: 'Ciclism Multidisciplinar',
      description: 'De la MTB la șosea - tehnici de pedalare și siguranță rutieră',
      image: '',
      badge: 'Primăvară-Toamnă',
      badgeColor: 'emerald'
    },
    {
      icon: 'directions_run',
      title: 'Alergare și Fitness',
      description: 'Dezvoltarea vitezei, rezistenței și condiției fizice generale',
      image: '',
      badge: 'Tot anul',
      badgeColor: 'blue'
    },
    {
      icon: 'downhill_skiing',
      title: 'Ski Alpin',
      description: 'Tabere pe pârtie - tehnici de coborâre și siguranță montană',
      image: '',
      badge: 'Iarnă',
      badgeColor: 'cyan'
    },
    {
      icon: 'park',
      title: 'Tabere în Natură',
      description: 'Aventuri outdoor, camping și activități de team building',
      image: '',
      badge: 'Vară',
      badgeColor: 'amber'
    },
    {
      icon: 'emoji_events',
      title: 'Competiții Multisport',
      description: 'Participare la competiții locale și naționale de înot, ciclism, alergare și alte sporturi',
      image: '',
      badge: 'Tot anul',
      badgeColor: 'blue'
    },
    {
      icon: 'explore',
      title: 'Orientare Montană',
      description: 'Învățarea orientării în natură și siguranței pe munte',
      image: '',
      badge: 'Vară',
      badgeColor: 'amber'
    },
    {
      icon: 'people',
      title: 'Team Building',
      description: 'Activități collaborative pentru consolidarea echipei',
      image: '',
      badge: 'Tot anul',
      badgeColor: 'emerald'
    }
  ];

  readonly testimonials: TestimonialCard[] = [
    {
      quote:
        'Alex a devenit mult mai disciplinat și încrezător în sine. Programul a depășit toate așteptările noastre.',
      name: 'Maria Popescu',
      role: 'Mama lui Alex (10 ani)',
      rating: 5,
      date: 'Ianuarie 2025',
      verified: true
    },
    {
      quote:
        'Ana își dorește să meargă la antrenamente în fiecare zi. A devenit pasionată de sport și își face prieteni noi.',
      name: 'Andrei Ionescu',
      role: 'Tatal Anei (12 ani)',
      rating: 5,
      date: 'Decembrie 2024',
      verified: true
    },
    {
      quote:
        'Antrenorii sunt fantastici! David a învățat să lucreze în echipă și să fie perseverent în toate activitățile.',
      name: 'Elena Dumitrescu',
      role: 'Mama lui David (8 ani)',
      rating: 5,
      date: 'Noiembrie 2024',
      verified: true
    }
  ];

  readonly newsletterPerks: string[] = [
    'Noutăți despre programe și tabere',
    'Resurse pentru părinți și copii activi',
    'Prioritate la înscrieri și evenimente speciale'
  ];

  readonly ctaBullets: string[] = [
    'Evaluare inițială gratuită',
    'Plan personalizat pe grupe de vârstă',
    'Feedback constant pentru părinți'
  ];

  private readonly fallbackTrainingSessions: TrainingSessionCard[] = [
    {
      id: 'fallback-swim',
      title: 'Antrenament de rezistență',
      sport: 'swim',
      startTime: '2025-02-15T17:00:00+02:00',
      endTime: '2025-02-15T18:30:00+02:00',
      coachName: 'Ana Popescu',
      locationName: 'Bazin Delfinul',
      image: '/ui/IMG_20240619_104545.jpg',
      description: 'Focus pe tehnica de înot, respirație și flotor.',
      sportLabel: 'Înot',
      icon: 'pool'
    },
    {
      id: 'fallback-bike',
      title: 'Lucru în echipă pe bicicletă',
      sport: 'bike',
      startTime: '2025-02-18T10:00:00+02:00',
      endTime: '2025-02-18T12:00:00+02:00',
      coachName: 'Mihai Ionescu',
      locationName: 'Pădurea Verde',
      image: '/ui/IMG-20190806-WA0023.jpg',
      description: 'Tehnici de control și echilibru pe trasee naturale.',
      sportLabel: 'Ciclism',
      icon: 'directions_bike'
    },
    {
      id: 'fallback-run',
      title: 'Tehnica de crawl și rezistență',
      sport: 'swim',
      startTime: '2025-02-22T09:30:00+02:00',
      endTime: '2025-02-22T11:00:00+02:00',
      coachName: 'Radu Petrescu',
      locationName: 'Stadion Dan Păltinișanu',
      image: '/ui/IMG_20241001_181451.jpg',
      description: 'Lucrăm la viteză, respirație și postura corectă.',
      sportLabel: 'Înot',
      icon: 'pool'
    },
    {
      id: 'fallback-camp',
      title: 'Pregătire pentru tabăra de ski',
      sport: 'camp',
      startTime: '2025-02-25T18:00:00+02:00',
      endTime: '2025-02-25T19:30:00+02:00',
      coachName: 'Echipa Motion',
      locationName: 'Sala Polivalentă',
      image: '/ui/IMG_20250220_113320.jpg',
      description: 'Mobilitate, forță și coordonare pentru sezonul de iarnă.',
      sportLabel: 'Tabără',
      icon: 'downhill_skiing'
    }
  ];

  newsletterEmail = '';
  newsletterStatus: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  newsletterMessage = '';
  showConfetti = false;
  newsletterSubscriberCount = 247; // Mock subscriber count
  private newsletterResetTimeout?: number;
  private confettiTimeouts: number[] = [];

  // toggleDarkMode removed

  scrollToTop(): void {
    if (this.isBrowser) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  scrollToSection(sectionId: string): void {
    if (this.isBrowser) {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  // Set up IntersectionObserver to reveal elements on scroll
  private setupScrollReveal(): void {
    if (!this.isBrowser) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    document.querySelectorAll('.scroll-reveal').forEach((el) => {
      observer.observe(el);
    });

    this.intersectionObserver = observer;
  }

  // ============================
  // Mobile carousel helpers
  // ============================
  private handleMobileTrackScroll = () => {
    if (this.mobileScrollRaf) cancelAnimationFrame(this.mobileScrollRaf);
    this.mobileScrollRaf = requestAnimationFrame(() => this.computeMobileActiveIndex());
  };

  private computeMobileActiveIndex(): void {
    const track = this.mobileTrackRef?.nativeElement;
    if (!track) return;
    const cards = track.querySelectorAll<HTMLElement>('.gallery-card-mobile');
    if (!cards || cards.length === 0) return;

    const viewportCenter = track.scrollLeft + track.clientWidth / 2;
    let closestIndex = 0;
    let closestDist = Number.POSITIVE_INFINITY;
    cards.forEach((card, idx) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const dist = Math.abs(cardCenter - viewportCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = idx;
      }
    });
    if (this.mobileActiveIndex !== closestIndex) {
      this.mobileActiveIndex = closestIndex;
    }
  }

  scrollToMobileSlide(index: number): void {
    const track = this.mobileTrackRef?.nativeElement;
    if (!track) return;
    const cards = track.querySelectorAll<HTMLElement>('.gallery-card-mobile');
    const target = cards.item(index);
    if (!target) return;
    // Use scroll snap to center the target card
    target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    this.mobileActiveIndex = index;
  }

  quickEnrollment(): void {
    if (this.isBrowser) {
      const email = prompt('Introduceți email-ul copilului pentru înscriere:');
      if (email) {
        // Show success toast instead of alert
        this.notificationService.success(
          'Înscriere inițiată!',
          `Mulțumim! Vă vom contacta în curând la ${email} pentru a finaliza înscrierea.`,
          {
            duration: 8000,
            action: {
              label: 'Închide',
              callback: () => {}
            }
          }
        );
      }
    }
  }

  // Lightbox methods
  openLightbox(index: number): void {
    if (!this.isBrowser) return;

    this.currentImageIndex = index;
    this.showLightbox = true;
    this.imageLoading = true;
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  }

  closeLightbox(): void {
    this.showLightbox = false;
    document.body.style.overflow = '';
  }

  nextImage(): void {
    if (this.currentImageIndex < this.moments.length - 1) {
      this.currentImageIndex++;
      this.imageLoading = true;
    } else {
      this.currentImageIndex = 0; // Loop back to first image
      this.imageLoading = true;
    }
  }

  previousImage(): void {
    if (this.currentImageIndex > 0) {
      this.currentImageIndex--;
      this.imageLoading = true;
    } else {
      this.currentImageIndex = this.moments.length - 1; // Loop to last image
      this.imageLoading = true;
    }
  }

  onImageLoad(success = true): void {
    this.imageLoading = false;
  }

  onTrainingImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.classList.add('loaded');
    console.log('Training image loaded successfully:', img.src);
  }

  onImageError(event: Event, session: TrainingSessionCard): void {
    console.warn('Image failed to load:', session.image, 'for session:', session.title);
    // Set a fallback image
    const img = event.target as HTMLImageElement;
    img.src = '/ui/IMG_20240415_163244.jpg'; // Default fallback image
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardNavigation(event: KeyboardEvent): void {
    if (!this.showLightbox) return;

    switch (event.key) {
      case 'Escape':
        this.closeLightbox();
        break;
      case 'ArrowLeft':
        this.previousImage();
        break;
      case 'ArrowRight':
        this.nextImage();
        break;
    }
  }

  onStaffCardClick(member: StaffMember): void {
    if (this.isBrowser) {
      // Navigate to staff profile or show modal
      console.log('Clicked staff member:', member.name);
      // You can implement navigation or modal display here
    }
  }

  onActivityCardClick(activity: ActivityCard): void {
    if (this.isBrowser) {
      // Navigate to activity details or show modal
      console.log('Clicked activity:', activity.title);
      // You can implement navigation or modal display here
    }
  }

  onTestimonialCardClick(testimonial: TestimonialCard): void {
    if (this.isBrowser) {
      // Navigate to testimonials page or show modal
      console.log('Clicked testimonial:', testimonial.name);
      // You can implement navigation or modal display here
    }
  }

  onTrainingCardClick(session: TrainingSessionCard): void {
    if (this.isBrowser) {
      // Navigate to training session details or show modal
      console.log('Clicked training session:', session.title);
      // You can implement navigation to session details or modal display here
      // For example: this.router.navigate(['/training', session.id]);
    }
  }

  async onNewsletterSubmit(form: NgForm): Promise<void> {
    const email = this.newsletterEmail?.trim();

    if (!email || !form.valid) {
      this.newsletterStatus = 'error';
      this.newsletterMessage = 'Te rugăm să introduci o adresă de email validă';
      this.showConfetti = false;

      // Show error toast
      this.notificationService.error(
        'Email invalid',
        'Te rugăm să introduci o adresă de email validă pentru a te abona la newsletter.'
      );
      return;
    }

    this.clearConfettiElements();

    this.newsletterStatus = 'loading';
    this.newsletterMessage = '';

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      this.newsletterStatus = 'success';
      this.newsletterMessage = '🎉 Te-ai abonat cu succes! Verifică inbox-ul pentru confirmare.';
      this.showConfetti = true;
      this.newsletterEmail = '';
      form.resetForm();

      this.triggerConfetti();

      // Show success toast
      this.notificationService.success(
        'Abonare reușită!',
        'Te-ai abonat cu succes la newsletter. Verifică inbox-ul pentru confirmare.',
        {
          duration: 6000,
          action: {
            label: 'OK',
            callback: () => {
              // Optional: navigate to a specific page or perform action
            }
          }
        }
      );

      if (this.newsletterResetTimeout) {
        clearTimeout(this.newsletterResetTimeout);
      }

      this.newsletterResetTimeout = window.setTimeout(() => {
        this.newsletterStatus = 'idle';
        this.showConfetti = false;
        this.clearConfettiElements();
        this.newsletterResetTimeout = undefined;
      }, 5000);

    } catch (error) {
      this.newsletterStatus = 'error';
      this.newsletterMessage = 'A apărut o eroare. Te rugăm să încerci din nou.';

      // Show error toast
      this.notificationService.error(
        'Eroare la abonare',
        'A apărut o problemă la abonarea la newsletter. Te rugăm să încerci din nou.',
        {
          action: {
            label: 'Reîncearcă',
            callback: () => {
              this.onNewsletterSubmit(form);
            }
          }
        }
      );
    }
  }

  private triggerConfetti(): void {
    if (!this.isBrowser) return;

    const container = document.querySelector('.newsletter-form');
    if (!container) return;

    this.clearConfettiElements();

    const confettiCount = 30;
    const emojis = ['🎉', '✨', '🎊', '⭐'];

    for (let i = 0; i < confettiCount; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti-piece';
      confetti.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      confetti.style.left = `${Math.random() * 100}%`;
      confetti.style.animationDelay = `${Math.random() * 0.5}s`;
      container.appendChild(confetti);

      const timeoutId = window.setTimeout(() => {
        confetti.remove();
      }, 3000);

      this.confettiTimeouts.push(timeoutId);
    }
  }

  private clearConfettiElements(): void {
    if (this.confettiTimeouts.length) {
      this.confettiTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      this.confettiTimeouts = [];
    }

    if (!this.isBrowser) return;

    document.querySelectorAll('.confetti-piece').forEach((element) => element.remove());
  }

  private buildUpcomingSessions(response: PagedResponse<ProgramCourse>): TrainingSessionCard[] {
    if (!response?.content?.length) {
      return [];
    }

    const now = Date.now();
    const sessions = response.content
      .flatMap((course) =>
        (course.occurrences ?? []).map((occurrence) => ({
          id: occurrence.id,
          title: course.name,
          sport: course.sport,
          coachName: course.coach?.name,
          locationName: course.location?.name,
          startTime: occurrence.startTime,
          endTime: occurrence.endTime,
          heroPhotoUrl: course.heroPhotoUrl
        }))
      )
      .filter((session) => {
        const start = Date.parse(session.startTime);
        return Number.isFinite(start) && start >= now;
      })
      .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))
      .slice(0, 4)
      .map((session) => {
        const visual = this.trainingVisualForSport(session.sport);
        // Convert relative heroPhotoUrl to absolute URL using the API base URL
        let imageUrl = visual.image;
        if (session.heroPhotoUrl) {
          // Check if it's already an absolute URL
          if (session.heroPhotoUrl.startsWith('http')) {
            imageUrl = session.heroPhotoUrl;
          } else {
            // Get the API base URL from the meta tag
            const meta = document.querySelector('meta[name="api-base-url"]') as HTMLMetaElement | null;
            const baseUrl = meta?.content?.trim() || '';
            imageUrl = `${baseUrl}${session.heroPhotoUrl}`;
          }
        }
        return {
          ...session,
          image: imageUrl,
          description: visual.description,
          sportLabel: visual.label,
          icon: visual.icon
        };
      });

    return sessions;
  }

  private trainingVisualForSport(sport: PublicSport | SportType | string): {
    image: string;
    description: string;
    label: string;
    icon: string;
  } {
    // Extract sport code from PublicSport object or use string directly
    let key: string;
    if (sport && typeof sport === 'object' && 'code' in sport) {
      key = sport.code.toLowerCase();
    } else if (typeof sport === 'string') {
      key = sport.toLowerCase();
    } else {
      key = 'general';
    }
    switch (key) {
      case 'swim':
        return {
          image: '/ui/IMG_20240619_104541.jpg',
          description: 'Lucrăm la tehnica de înot, respirație și flotabilitate.',
          label: 'Înot',
          icon: 'pool'
        };
      case 'bike':
        return {
          image: '/ui/IMG-20180821-WA0003.jpg',
          description: 'Consolidăm controlul bicicletei în siguranță, pe trasee variate.',
          label: 'Ciclism',
          icon: 'directions_bike'
        };
      case 'run':
        return {
          image: '/ui/IMG_20241001_181457.jpg',
          description: 'Construim rezistența și viteză cu exerciții dinamice.',
          label: 'Alergare',
          icon: 'directions_run'
        };
      default:
        return {
          image: '/ui/IMG_20240415_163244.jpg',
          description: 'Antrenament multisport pentru echilibru, coordonare și încredere.',
          label: 'Multisport',
          icon: 'emoji_events'
        };
    }
  }

  private pickNextCamp(camps: CampSummary[]): CampSummary | null {
    if (!camps?.length) {
      return null;
    }

    const now = Date.now();
    const upcoming = camps
      .filter((camp) => {
        const end = Date.parse(camp.endDate ?? camp.startDate);
        return !Number.isNaN(end) && end >= now;
      })
      .sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate));

    if (upcoming.length) {
      return upcoming[0];
    }

    const sorted = [...camps].sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
    return sorted[0] ?? null;
  }

  // ============================================
  // COUNTER ANIMATIONS
  // ============================================
  private initCounterAnimations(): void {
    // Initialize animatedValues array with target values to avoid ExpressionChangedAfterItHasBeenCheckedError
    this.animatedValues = this.resultHighlights.map(highlight =>
      highlight.numericValue ? highlight.numericValue : NaN
    );
  }

  private startCounterAnimations(): void {
    if (!this.isBrowser) return;

    this.resultHighlights.forEach((highlight, index) => {
      if (highlight.numericValue) {
        this.animateCounter(index, highlight.numericValue, 1500); // 1.5 second animation
      }
    });
  }

  private animateCounter(index: number, target: number, duration: number): void {
    const startTime = performance.now();
    const startValue = 0;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // easeOutQuart easing function
      const easeOutQuart = (t: number): number => {
        return 1 - Math.pow(1 - t, 4);
      };

      let easedProgress = easeOutQuart(progress);

      // Overshoot logic for the last 10% of animation
      if (progress > 0.9) {
        const overshootProgress = (progress - 0.9) / 0.1;
        const overshootAmount = Math.sin(overshootProgress * Math.PI) * 0.1; // 10% overshoot
        easedProgress = Math.min(1, easedProgress + overshootAmount);
      }

      this.animatedValues[index] = Math.floor(startValue + (target - startValue) * easedProgress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.animatedValues[index] = target;
        // Trigger celebration when counter finishes
        this.celebrateCounter(index);
      }
    };

    requestAnimationFrame(animate);
  }

  getDisplayValue(index: number): string {
    const highlight = this.resultHighlights[index];

    if (highlight.numericValue && this.animatedValues[index] !== undefined) {
      return `${this.animatedValues[index]}${highlight.suffix || ''}`;
    }

    return highlight.value;
  }

  // Helper method to convert JPG paths to WebP
  toWebP(imagePath: string): string {
    if (!imagePath) return '';
    return imagePath.toLowerCase().replace(/\.jpe?g$/i, '.webp');
  }

  private celebrateCounter(index: number): void {
    if (!this.isBrowser) return;

    // Find the corresponding result card element
    const resultCards = document.querySelectorAll('.result-card');
    if (resultCards[index]) {
      const card = resultCards[index] as HTMLElement;

      // Add celebration pulse class
      card.classList.add('celebration-pulse');

      // Remove the class after animation completes
      setTimeout(() => {
        card.classList.remove('celebration-pulse');
      }, 600); // Match the animation duration
    }
  }

  // Get coach avatar URL (convert relative to absolute)
  getCoachAvatarUrl(avatarUrl: string | undefined): string {
    if (!avatarUrl) {
      return '';
    }
    
    // If already absolute URL, return as is
    if (avatarUrl.startsWith('http')) {
      return avatarUrl;
    }
    
    // Convert relative URL to absolute
    if (this.isBrowser) {
      const meta = document.querySelector('meta[name="api-base-url"]') as HTMLMetaElement | null;
      const baseUrl = meta?.content?.trim() || '';
      return `${baseUrl}${avatarUrl}`;
    }
    
    return avatarUrl;
  }

  // Handle coach avatar loading error
  onCoachAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const avatarContainer = img.parentElement;
    
    // Hide image
    img.style.display = 'none';
    
    // Show initial letter instead
    if (avatarContainer) {
      const initialSpan = avatarContainer.querySelector('.premium-coach-card__initial') as HTMLElement;
      if (initialSpan) {
        initialSpan.style.display = 'block';
      }
    }
  }

  // Load programs from API (browser only)
  private loadPrograms(): void {
    this.isLoadingPrograms.set(true);
    this.publicApi
      .getSchedule({ size: 12 })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((response) => this.mapCoursesToPrograms(response.content).slice(0, 3)),
        catchError(() => of(this.fallbackPrograms.slice(0, 3))),
        finalize(() => this.isLoadingPrograms.set(false))
      )
      .subscribe({
        next: (programs) => {
          this.programs.set(programs);
        },
        error: () => {
          this.programs.set(this.fallbackPrograms.slice(0, 3));
        }
      });
  }

  // Load coaches from API (browser only)
  private loadCoaches(): void {
    this.isLoadingCoaches.set(true);
    this.publicApi
      .getCoaches()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((coaches) => coaches.slice(0, 4)),
        catchError(() => of([])),
        finalize(() => this.isLoadingCoaches.set(false))
      )
      .subscribe({
        next: (coaches) => {
          this.coaches.set(coaches);
        },
        error: () => {
          this.coaches.set([]);
        }
      });
  }

  // Map API courses to program cards
  private mapCoursesToPrograms(courses: ProgramCourse[]): ProgramCard[] {
    const accentColors: ('blue' | 'indigo' | 'cyan' | 'purple')[] = ['blue', 'indigo', 'cyan', 'purple'];
    const sportIcons: Record<string, string> = {
      'swim': '🏊',
      'inot': '🏊',
      'bike': '🚴',
      'ciclism': '🚴',
      'run': '🏃',
      'alergare': '🏃',
      'triatlon': '🏊‍♂️',
      'ski': '⛷️'
    };

    return courses.map((course, index) => {
      const sportCode = course.sport?.code?.toLowerCase() || '';
      const sportName = course.sport?.name || 'Multisport';
      const icon = sportIcons[sportCode] || '🏆';
      
      let ageRange = '';
      if (course.ageMin && course.ageMax) {
        ageRange = `${course.ageMin}-${course.ageMax} ani`;
      } else if (course.ageMin) {
        ageRange = `${course.ageMin}+ ani`;
      } else if (course.ageMax) {
        ageRange = `până la ${course.ageMax} ani`;
      }

      // Convert relative heroPhotoUrl to absolute URL
      let imageUrl = this.trainingVisualForSport(course.sport).image;
      if (course.heroPhotoUrl) {
        if (course.heroPhotoUrl.startsWith('http')) {
          imageUrl = course.heroPhotoUrl;
        } else {
          const meta = this.isBrowser 
            ? document.querySelector('meta[name="api-base-url"]') as HTMLMetaElement | null
            : null;
          const baseUrl = meta?.content?.trim() || '';
          imageUrl = `${baseUrl}${course.heroPhotoUrl}`;
        }
      }

      return {
        title: course.name,
        description: course.description || `Antrenament ${sportName.toLowerCase()} pentru dezvoltarea abilităților sportive`,
        image: imageUrl,
        ageRange: ageRange,
        link: `/cursuri/${course.id}`,
        accent: accentColors[index % accentColors.length],
        categoryIcon: icon,
        categoryLabel: sportName,
        popularityTag: index < 2 ? 'popular' : undefined
      };
    });
  }
}
