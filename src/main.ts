import { provideHttpClient } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  appsOutline,
  arrowBackCircleOutline,
  checkmarkCircle,
  checkmarkCircleOutline,
  closeCircle,
  desktopOutline,
  keypadOutline,
  listOutline,
  phonePortraitOutline,
  qrCodeOutline,
  refreshOutline,
  scanOutline,
  shieldCheckmark,
  shieldCheckmarkOutline,
  trashOutline,
  warningOutline,
} from 'ionicons/icons';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

addIcons({
  appsOutline,
  arrowBackCircleOutline,
  checkmarkCircle,
  checkmarkCircleOutline,
  closeCircle,
  desktopOutline,
  keypadOutline,
  listOutline,
  phonePortraitOutline,
  qrCodeOutline,
  refreshOutline,
  scanOutline,
  shieldCheckmark,
  shieldCheckmarkOutline,
  trashOutline,
  warningOutline,
});

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideHttpClient(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
  ],
});
