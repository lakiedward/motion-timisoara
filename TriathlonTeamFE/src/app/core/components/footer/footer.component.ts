import { NgFor, CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

interface FooterLink {
  label: string;
  path: string;
}

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, NgFor, RouterLink, MatIconModule],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent {
  readonly currentYear = new Date().getFullYear();

  readonly navigationLinks: FooterLink[] = [
    { label: 'Acasă', path: '/' },
    { label: 'Despre Noi', path: '/despre' },
    { label: 'Antrenori', path: '/antrenori' },
    { label: 'Contact', path: '/contact' }
  ];

  readonly programLinks: FooterLink[] = [
    { label: 'Cursuri', path: '/cursuri' },
    { label: 'Tabere', path: '/tabere' },
    { label: 'Activități', path: '/activitati' }
  ];

  readonly legalLinks: FooterLink[] = [
    { label: 'Politica de Confidențialitate', path: '/privacy' },
    { label: 'Termeni și Condiții', path: '/terms' },
    { label: 'GDPR', path: '/gdpr' }
  ];

  readonly socialLinks = [
    { icon: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/triathlonteamtimisoara' },
    { icon: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/triathlonteamtimisoara' }
  ];
}
