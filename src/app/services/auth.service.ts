import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface QrRequest {
  id: string;
  service: string;
  email: string;
  status: 'pendiente' | 'aprobado' | 'cancelado';
  pin?: string;
  createdAt: string;
  qrData?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /** Genera nueva solicitud y cancela pendientes previas del mismo correo */
  generate(email: string, service: string): Observable<QrRequest> {
    return this.http
      .post<QrRequest>(`${this.API}/api/generate`, { email, service })
      .pipe(catchError(this.handleError));
  }

  /** Lista las últimas 20 solicitudes */
  getRequests(): Observable<QrRequest[]> {
    return this.http
      .get<QrRequest[]>(`${this.API}/api/requests`)
      .pipe(catchError(this.handleError));
  }

  /** Mobile: obtiene el PIN tras escanear el QR */
  scan(id: string): Observable<QrRequest> {
    return this.http
      .get<QrRequest>(`${this.API}/api/scan/${id}`)
      .pipe(catchError(this.handleError));
  }

  /** Web: verifica el PIN ingresado */
  verify(id: string, pin: string): Observable<{ success: boolean; status: string }> {
    return this.http
      .post<{ success: boolean; status: string }>(`${this.API}/api/verify`, { id, pin })
      .pipe(catchError(this.handleError));
  }

  /** Cancela/revoca una solicitud pendiente */
  revoke(id: string): Observable<{ success: boolean }> {
    return this.http
      .delete<{ success: boolean }>(`${this.API}/api/revoke/${id}`)
      .pipe(catchError(this.handleError));
  }

  /** Polling del estado de una solicitud */
  getStatus(id: string): Observable<{ status: string }> {
    return this.http
      .get<{ status: string }>(`${this.API}/api/status/${id}`)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    const msg = error.error?.error || error.message || 'Error desconocido';
    return throwError(() => new Error(msg));
  }
}
