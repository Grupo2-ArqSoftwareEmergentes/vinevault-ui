import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { API_CONFIG } from '../../../../api.config';
import { ProfileComponent } from './profile';
import { PREFERRED_LANGUAGE_STORAGE_KEY, UserProfile } from '../../../domain/models/profile';
import { AuthStateService } from '../../state/auth-state/auth-state';
import { StorageService } from '../../../../core/services/storage/storage';
import { WorkspaceApiService } from '../../../../shared/services/workspace-api.service';

const base = API_CONFIG.baseUrl;

const sampleProfile: UserProfile = {
  id: 7,
  username: 'sommelier1',
  email: 'sommelier@example.com',
  full_name: 'Ana Sommelier',
  preferred_language: 'es',
  is_active: true,
  created_at: '2026-11-19T22:00:00Z',
  updated_at: null,
  last_login: null,
};

describe('Profile page', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.removeItem(PREFERRED_LANGUAGE_STORAGE_KEY);
    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: WorkspaceApiService, useValue: { getContext: () => of({ spaces: [], cellars: [] }) } },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem(PREFERRED_LANGUAGE_STORAGE_KEY);
    document.documentElement.lang = 'es';
  });

  it('preloads profile fields from GET /api/v1/profile and keeps save disabled until a field changes', async () => {
    http.expectOne(`${base}/api/v1/profile`).flush(sampleProfile);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.profileForm.getRawValue()).toEqual({
      full_name: 'Ana Sommelier',
      username: 'sommelier1',
      email: 'sommelier@example.com',
      preferred_language: 'es',
    });
    const saveBtn = fixture.nativeElement.querySelector('.save-profile-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.identity-pill')?.textContent).toContain('Ana Sommelier');
  });

  it('updates only changed fields via PATCH /api/v1/profile, disables duplicate submit and syncs session + language', async () => {
    http.expectOne(`${base}/api/v1/profile`).flush(sampleProfile);
    await fixture.whenStable();
    fixture.detectChanges();

    component.profileForm.controls.username.setValue('anaReserve9');
    component.profileForm.controls.preferred_language.setValue('en');
    fixture.detectChanges();

    const saveBtn = fixture.nativeElement.querySelector('.save-profile-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);

    component.saveProfile();
    component.saveProfile(); // duplicate click ignored while in flight
    fixture.detectChanges();
    expect(saveBtn.disabled).toBe(true);

    const patchReq = http.expectOne(`${base}/api/v1/profile`);
    expect(patchReq.request.method).toBe('PATCH');
    expect(patchReq.request.body).toEqual({
      username: 'anaReserve9',
      preferred_language: 'en',
    });
    patchReq.flush({ ...sampleProfile, username: 'anaReserve9', preferred_language: 'en' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.profileSuccess()).toContain('Cambios guardados');
    expect(TestBed.inject(AuthStateService).getCurrentState().user?.username).toBe('anaReserve9');
    expect(TestBed.inject(StorageService).get<string>(PREFERRED_LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(fixture.nativeElement.querySelector('.profile-username')?.textContent?.trim()).toBe('anaReserve9');
  });

  it('shows 409 conflict messages without losing the user input', async () => {
    http.expectOne(`${base}/api/v1/profile`).flush(sampleProfile);
    await fixture.whenStable();

    component.profileForm.controls.email.setValue('taken@example.com');
    component.saveProfile();
    http.expectOne(`${base}/api/v1/profile`).flush(
      { detail: { code: 'EMAIL_TAKEN', message: 'El correo ya está registrado.' } },
      { status: 409, statusText: 'Conflict' }
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.profileError()).toBe('El correo ya está registrado.');
    expect(component.profileForm.controls.email.value).toBe('taken@example.com');
  });

  it('validates password confirmation and policy before sending, clears inputs on success and preserves inputs on 401', async () => {
    http.expectOne(`${base}/api/v1/profile`).flush(sampleProfile);
    await fixture.whenStable();

    // Mismatched passwords must not trigger HTTP.
    component.passwordForm.setValue({
      current_password: 'OldPassword123',
      new_password: 'NewPassword456',
      confirm_password: 'DifferentPassword789',
    });
    component.savePassword();
    http.expectNone(`${base}/api/v1/profile/change-password`);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('no coinciden');

    // Wrong current password (401 INVALID_CURRENT_PASSWORD) shows message without clearing inputs.
    component.passwordForm.controls.confirm_password.setValue('NewPassword456');
    component.savePassword();
    const firstPost = http.expectOne(`${base}/api/v1/profile/change-password`);
    expect(firstPost.request.body).toEqual({ current_password: 'OldPassword123', new_password: 'NewPassword456' });
    firstPost.flush(
      { detail: { code: 'INVALID_CURRENT_PASSWORD', message: 'La contraseña actual no es correcta.' } },
      { status: 401, statusText: 'Unauthorized' }
    );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.passwordError()).toBe('La contraseña actual no es correcta.');
    expect(component.passwordForm.controls.new_password.value).toBe('NewPassword456');

    // Successful password change clears all fields and displays security notice.
    component.savePassword();
    const okPost = http.expectOne(`${base}/api/v1/profile/change-password`);
    okPost.flush({ message: 'Contraseña actualizada.', sessions_revoked: false, security_notice: 'Tu sesión sigue activa.' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.passwordSuccess()).toBe('Contraseña actualizada.');
    expect(component.passwordSecurityNotice()).toBe('Tu sesión sigue activa.');
    expect(component.passwordForm.getRawValue()).toEqual({
      current_password: '',
      new_password: '',
      confirm_password: '',
    });
  });

  it('offers retry when initial profile load fails', async () => {
    http.expectOne(`${base}/api/v1/profile`).flush({}, { status: 0, statusText: 'Network Error' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.loadError()).toContain('No pudimos conectar');
    fixture.nativeElement.querySelector('.secondary-action').click();
    http.expectOne(`${base}/api/v1/profile`).flush(sampleProfile);
    await fixture.whenStable();
    expect(component.loadedProfile()?.username).toBe('sommelier1');
  });
});
