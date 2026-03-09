import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FooterComponent } from '../footer/footer.component';
import { HeaderComponent } from '../header/header.component';
import { LoaderOverlayComponent } from '../../../shared/components/loader-overlay/loader-overlay.component';
import { FabAccountComponent } from '../fab-account/fab-account.component';

@Component({
  selector: 'app-core-layout',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, LoaderOverlayComponent, FabAccountComponent],
  templateUrl: './core-layout.component.html',
  styleUrls: ['./core-layout.component.scss']
})
export class CoreLayoutComponent {}
