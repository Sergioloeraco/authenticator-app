import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Capacitor } from '@capacitor/core';
import { Subscription, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import QRCode from 'qrcode';
import { IonicModule } from '@ionic/angular';
import { AuthService, QrRequest } from '../services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit, OnDestroy {

  // â”€â”€ Vista activa (toggle WEB / MÃ“VIL) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  currentView: 'web' | 'mobile' = Capacitor.isNativePlatform() ? 'mobile' : 'web';
  get isWeb() { return this.currentView === 'web'; }

  // â”€â”€ Estado WEB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  email = '';
  service = 'Servicio Normal';
  qrDataUrl = '';
  currentRequestId = '';
  requests: QrRequest[] = [];
  pinInput = '';
  verifyMsg = '';
  verifySuccess = false;
  isGenerating = false;
  apiConnected = false;

  // â”€â”€ Estado MÃ“VIL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  scannedPin = '';
  scannedService = '';
  scannedEmail = '';
  isScanning = false;
  scanError = '';
  // Fallback: en browser no hay cÃ¡mara nativa, se puede ingresar el ID manualmente
  manualId = '';
  showManual = false;

  private pollSub?: Subscription;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private Scanner: any = null;

  constructor(private authService: AuthService) {}

  async ngOnInit() {
    // Cargar BarcodeScanner solo si estamos en nativo
    if (Capacitor.isNativePlatform()) {
      try {
        const m = await import('@capacitor-mlkit/barcode-scanning');
        this.Scanner = m.BarcodeScanner;
      } catch {
        console.warn('BarcodeScanner no disponible');
      }
    }

    // Arrancar carga de solicitudes y polling
    await this.loadRequests();
    this.startPolling();
    this.apiConnected = true;
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
    this.stopScannerIfActive();
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // WEB METHODS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  switchView(v: 'web' | 'mobile') {
    this.currentView = v;
  }

  async generateQR() {
    if (!this.email.trim()) return;
    this.isGenerating = true;
    this.verifyMsg = '';
    this.pinInput = '';
    this.qrDataUrl = '';

    this.authService.generate(this.email.trim(), this.service).subscribe({
      next: async (res) => {
        this.currentRequestId = res.id;
        // El QR codifica Ãºnicamente el ID de la solicitud
        this.qrDataUrl = await QRCode.toDataURL(res.qrData ?? res.id, {
          width: 260,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        });
        await this.loadRequests();
        this.isGenerating = false;
      },
      error: (err) => {
        console.error(err);
        this.isGenerating = false;
      },
    });
  }

  loadRequests() {
    return new Promise<void>((resolve) => {
      this.authService.getRequests().subscribe({
        next: (reqs) => { this.requests = reqs; resolve(); },
        error: () => resolve(),
      });
    });
  }

  startPolling() {
    this.pollSub = interval(2500)
      .pipe(switchMap(() => this.authService.getRequests()))
      .subscribe({ next: (reqs) => { this.requests = reqs; } });
  }

  verifyPin() {
    if (!this.currentRequestId || this.pinInput.length < 6) return;
    this.authService.verify(this.currentRequestId, this.pinInput).subscribe({
      next: () => {
        this.verifyMsg = 'âœ“ RecuperaciÃ³n aprobada correctamente';
        this.verifySuccess = true;
        this.qrDataUrl = '';
        this.loadRequests();
      },
      error: (err) => {
        this.verifyMsg = err.message || 'PIN incorrecto';
        this.verifySuccess = false;
      },
    });
  }

  revokeRequest(id: string) {
    this.authService.revoke(id).subscribe({
      next: () => {
        if (id === this.currentRequestId) {
          this.currentRequestId = '';
          this.qrDataUrl = '';
        }
        this.loadRequests();
      },
    });
  }

  // Helpers de UI
  statusColor(status: string) {
    return status === 'aprobado' ? 'success' : status === 'pendiente' ? 'warning' : 'medium';
  }

  statusLabel(status: string) {
    return status === 'aprobado' ? 'Aprobado' : status === 'pendiente' ? 'Pendiente' : 'Cancelado';
  }

  fmtDate(d: string) {
    return new Date(d).toLocaleString('es-MX', {
      month: 'numeric', day: 'numeric', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  }

  get pinDigits(): string[] {
    return this.pinInput.padEnd(6, ' ').split('').slice(0, 6);
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // MOBILE METHODS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async scanQR() {
    if (!this.Scanner) {
      // Fallback en browser: mostrar entrada manual
      this.showManual = true;
      return;
    }

    try {
      const perm = await this.Scanner.requestPermissions();
      if (perm.camera !== 'granted') {
        this.scanError = 'Permiso de cámara denegado. Ve a Ajustes y actívalo.';
        return;
      }

      this.isScanning = true;
      this.scannedPin = '';
      this.scanError = '';

      const result = await this.Scanner.scan();
      this.isScanning = false;

      const barcode = result.barcodes?.[0];
      const content = barcode?.rawValue ?? barcode?.displayValue;
      if (content) {
        await this.fetchPinFromId(content.trim());
      }
    } catch (err: unknown) {
      this.isScanning = false;
      this.scanError = (err as Error).message ?? 'Error al escanear';
    }
  }
  submitManualId() {
    if (!this.manualId.trim()) return;
    this.showManual = false;
    this.fetchPinFromId(this.manualId.trim());
    this.manualId = '';
  }

  async fetchPinFromId(id: string) {
    this.authService.scan(id).subscribe({
      next: (data) => {
        this.scannedPin = data.pin ?? '';
        this.scannedService = data.service;
        this.scannedEmail = data.email;
        this.scanError = '';
      },
      error: (err) => {
        this.scanError = err.message ?? 'Error al obtener datos del servidor';
      },
    });
  }

  cancelScan() {
    this.stopScannerIfActive();
    this.isScanning = false;
  }

  resetMobile() {
    this.scannedPin = '';
    this.scannedService = '';
    this.scannedEmail = '';
    this.scanError = '';
    this.showManual = false;
  }

  private stopScannerIfActive() {
    if (this.Scanner && this.isScanning) {
      this.Scanner.stopScan().catch(() => {});
      this.Scanner.removeAllListeners?.().catch(() => {});
    }
  }
}


