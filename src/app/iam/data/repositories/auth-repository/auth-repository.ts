import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthResponse, LoginCredentials, RegisterPayload, User } from '../../../domain/models/user';
import { API_CONFIG } from '../../../../api.config';

@Injectable({
  providedIn: 'root',
})
export class AuthRepository {
  private readonly serviceUrl = API_CONFIG.baseUrl;
  private readonly baseUrl = `${this.serviceUrl}/api/v1/iam`;

  constructor(private http: HttpClient) {}

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    const body = new HttpParams()
      .set('username', credentials.username)
      .set('password', credentials.password);

    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, body, {
      headers: new HttpHeaders({
        'Content-Type': 'application/x-www-form-urlencoded',
      }),
    });
  }

  register(payload: RegisterPayload): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/register`, payload);
  }

  refresh(refreshToken: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/refresh`, {
      refresh_token: refreshToken,
    });
  }

  getCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/me`);
  }

  listUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.baseUrl}/users`);
  }

  health(): Observable<unknown> {
    return this.http.get<unknown>(`${this.baseUrl}/health`);
  }

  getServiceInfo(): Observable<unknown> {
    return this.http.get<unknown>(this.serviceUrl);
  }
}
