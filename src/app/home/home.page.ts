import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
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
  private readonly requestIdPattern = /^[a-f0-9]{24}$/i;

  constructor(private authService: AuthService, private route: ActivatedRoute) {}

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

    const scanId = this.route.snapshot.queryParamMap.get('scanId');
    if (scanId) {
      this.handleScannedContent(scanId);
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
        // El QR codifica un enlace de la app con el ID de la solicitud
        const requestId = this.extractRequestId(res.qrData ?? res.id) || res.id;
        this.qrDataUrl = await QRCode.toDataURL(this.buildQrPayload(requestId), {
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
        next: (reqs) => { this.syncRequests(reqs); resolve(); },
        error: () => resolve(),
      });
    });
  }

  startPolling() {
    this.pollSub = interval(2500)
      .pipe(switchMap(() => this.authService.getRequests()))
      .subscribe({ next: (reqs) => { this.syncRequests(reqs); } });
  }

  verifyPin() {
    const pin = this.normalizePin(this.pinInput);
    this.pinInput = pin;

    if (!this.currentRequestId || pin.length < 6) return;
    this.authService.verify(this.currentRequestId, pin).subscribe({
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
    return this.normalizePin(this.pinInput).padEnd(6, ' ').split('').slice(0, 6);
  }

  get canVerifyPin(): boolean {
    return this.normalizePin(this.pinInput).length === 6;
  }

  private syncRequests(reqs: QrRequest[]) {
    this.requests = reqs;
    this.syncCurrentPinFromRequests();
  }

  private syncCurrentPinFromRequests() {
    if (!this.currentRequestId || this.verifySuccess) return;

    const currentRequest = this.requests.find((req) => req.id === this.currentRequestId);
    if (!currentRequest || currentRequest.status !== 'pendiente') return;

    const scannedPin = this.normalizePin(currentRequest.pin);
    if (scannedPin.length !== 6 || this.pinInput === scannedPin) return;

    this.pinInput = scannedPin;
    this.verifyMsg = '';
    this.verifySuccess = false;
  }

  private normalizePin(pin?: string): string {
    return String(pin ?? '').replace(/\D/g, '').slice(0, 6);
  }

  private buildQrPayload(id: string): string {
    const url = new URL('/home', window.location.origin);
    url.searchParams.set('scanId', id);
    return url.toString();
  }

  private extractRequestId(content: string): string {
    const value = content.trim();
    if (!value) return '';

    const idFromUrl = this.extractRequestIdFromUrl(value);
    if (idFromUrl) return idFromUrl;

    return this.requestIdPattern.test(value) ? value : '';
  }

  private extractRequestIdFromUrl(value: string): string {
    try {
      const url = new URL(value, window.location.origin);
      const scanId = url.searchParams.get('scanId') ?? url.searchParams.get('id') ?? '';
      return this.requestIdPattern.test(scanId) ? scanId : '';
    } catch {
      return '';
    }
  }

  private handleScannedContent(content: string) {
    const id = this.extractRequestId(content);
    this.currentView = 'mobile';
    this.scannedPin = '';
    this.showManual = false;

    if (!id) {
      this.scanError = 'QR no valido para esta app. Genera uno nuevo desde el portal.';
      return;
    }

    this.scanError = '';
    this.fetchPinFromId(id);
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

      const result = await this.Scanner.scan({ formats: ['QR_CODE'] });
      this.isScanning = false;

      const barcode = result.barcodes?.[0];
      const content = barcode?.rawValue ?? barcode?.displayValue;
      if (content) {
        this.handleScannedContent(content);
      } else {
        this.scanError = 'No se pudo leer el QR. Intenta enfocarlo de nuevo.';
      }
    } catch (err: unknown) {
      this.isScanning = false;
      this.scanError = (err as Error).message ?? 'Error al escanear';
    }
  }
  submitManualId() {
    if (!this.manualId.trim()) return;
    this.handleScannedContent(this.manualId.trim());
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


