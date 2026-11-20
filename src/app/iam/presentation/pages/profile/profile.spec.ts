import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { API_CONFIG } from '../../../../api.config';
import { ProfileComponent } from './profile';
import { PREFERRED_LANGUAGE_STORAGE_KEY, UserProfile } from '../../../domain/models/profile';
import { AuthStateService } from '../../state/auth-state/auth-state';
import { StorageService } from '../../../../core/services/storage/storage';
import { WorkspaceApiService } from '../../../../shared/services/workspace-api.service';
import { WorkspaceDirectory } from '../../../../shared/models/workspace-context';
import { ownerAccess } from '../../../../shared/testing/workspace.fixtures';
import { EditProfileDialogComponent } from '../../components/edit-profile-dialog/edit-profile-dialog';
import { ChangePasswordDialogComponent } from '../../components/change-password-dialog/change-password-dialog';
import { NotificationService } from '../../../../core/services/notification/notification';

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

const sampleDirectory: WorkspaceDirectory = {
  spaces: [
    { ...ownerAccess, id: { value: 'space-pro' }, name: 'Bodega Central', spaceType: 'BUSINESS', subscriptionPlan: 'PRO', subscriptionStatus: 'ACTIVE', subscriptionExpiresAt: '2026-12-31T00:00:00Z' },
    { ...ownerAccess, id: { value: 'space-free' }, name: 'Mi Colección', spaceType: 'COLLECTOR', subscriptionPlan: 'FREE', subscriptionStatus: 'ACTIVE' },
  ],
  cellars: [],
  account_quota: {
    extra_spaces_allowance: 2,
    current_spaces: 2,
    max_spaces: 4,
    remaining_spaces: 2,
    can_create_collector: true,
    can_create_business: true,
  },
};

describe('Profile page (3-section layout + burgundy modals)', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let http: HttpTestingController;

  const flushInitial = (profile: UserProfile = sampleProfile) => {
    http.expectOne(`${base}/api/v1/profile`).flush(profile);
  };

  beforeEach(async () => {
    localStorage.removeItem(PREFERRED_LANGUAGE_STORAGE_KEY);
    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: WorkspaceApiService, useValue: { getContext: () => of(sampleDirectory) } },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    vi.spyOn(TestBed.inject(NotificationService), 'show');
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    TestBed.inject(MatDialog).closeAll();
    localStorage.removeItem(PREFERRED_LANGUAGE_STORAGE_KEY);
    document.documentElement.lang = 'es';
    vi.restoreAllMocks();
  });

  it('renders a clean read-only summary with no open inputs, plus language and active subscriptions sections', async () => {
    flushInitial();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const header = element.querySelector('.profile-header')!;
    expect(header.textContent?.trim()).toBe('Cuenta y Perfil');
    expect(header.children).toHaveLength(1);
    expect(element.querySelector('.identity-pill, .identity-avatar, .eyebrow, .card-eyebrow, .card-subtitle, .lead')).toBeNull();
    expect(element.querySelector('main')?.textContent).not.toMatch(/APARTADO|CUENTA PERSONAL/);
    expect(Array.from(element.querySelectorAll('.section-card h2')).map(title => title.textContent?.trim())).toEqual([
      'Datos personales y contraseña', 'Idioma', 'Suscripciones',
    ]);
    expect(Array.from(element.querySelectorAll('.detail-row dt')).map(label => label.textContent?.trim())).toEqual([
      'Nombre completo', 'Nombre de usuario', 'Correo electrónico', 'Contraseña',
    ]);
    // No exposed open inputs on the page itself.
    expect(element.querySelectorAll('main input')).toHaveLength(0);

    // Section 1: Personal data + masked password.
    expect(element.textContent).toContain('Ana Sommelier');
    expect(element.textContent).toContain('@sommelier1');
    expect(element.textContent).toContain('sommelier@example.com');
    expect(element.querySelector('.password-masked')?.textContent).toContain('••••');

    // Section 2: Language radio group.
    expect(element.querySelector('[data-lang="es"]')?.getAttribute('aria-checked')).toBe('true');
    expect(element.querySelector('[data-lang="en"]')?.getAttribute('aria-checked')).toBe('false');
    expect(element.querySelector('[data-lang="es"]')?.textContent).toContain('Español (es)');
    expect(element.querySelector('[data-lang="en"]')?.textContent).toContain('Inglés (en)');

    expect(element.querySelector('.manage-plans-link')?.getAttribute('href')).toBe('/subscription');
    expect(element.querySelector('.manage-plans-link')?.textContent).toContain('Ver suscripciones');
    expect(element.querySelector('.subscriptions-list, .subscription-row')).toBeNull();
    http.expectNone(req => req.url.includes('/subscriptions/'));
  });

  it('opens the burgundy EditProfileDialog, sends only changed fields via PATCH, updates summary and syncs session', async () => {
    flushInitial();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.edit-profile-trigger').click();
    await fixture.whenStable();

    const dialogs = TestBed.inject(MatDialog).openDialogs;
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0].componentInstance).toBeInstanceOf(EditProfileDialogComponent);
    const dialogComp = dialogs[0].componentInstance as EditProfileDialogComponent;

    dialogComp.form.controls.username.setValue('anaReserve9');
    dialogComp.submit();
    const patchReq = http.expectOne(`${base}/api/v1/profile`);
    expect(patchReq.request.method).toBe('PATCH');
    expect(patchReq.request.body).toEqual({ username: 'anaReserve9' });
    patchReq.flush({ ...sampleProfile, username: 'anaReserve9' });
    await vi.waitFor(() => expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.loadedProfile()?.username).toBe('anaReserve9');
    expect(TestBed.inject(NotificationService).show).toHaveBeenCalledWith('Datos personales actualizados correctamente.', 'success');
    expect(fixture.nativeElement.querySelector('.feedback')).toBeNull();
    expect(TestBed.inject(AuthStateService).getCurrentState().user?.username).toBe('anaReserve9');
    expect(fixture.nativeElement.querySelector('.profile-username')?.textContent?.trim()).toBe('anaReserve9');
  });

  it('keeps EditProfileDialog open with typed values when backend returns 409 EMAIL_TAKEN', async () => {
    flushInitial();
    await fixture.whenStable();
    fixture.detectChanges();

    component.openEditProfileModal();
    await fixture.whenStable();
    const dialogComp = TestBed.inject(MatDialog).openDialogs[0].componentInstance as EditProfileDialogComponent;

    dialogComp.form.controls.email.setValue('taken@example.com');
    dialogComp.submit();
    http.expectOne(`${base}/api/v1/profile`).flush(
      { detail: { code: 'EMAIL_TAKEN', message: 'El correo ya está en uso.' } },
      { status: 409, statusText: 'Conflict' }
    );
    await fixture.whenStable();

    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(1);
    expect(dialogComp.error()).toBe('El correo ya está en uso.');
    expect(dialogComp.form.controls.email.value).toBe('taken@example.com');
  });

  it('opens the burgundy ChangePasswordDialog, validates confirmation, preserves input on 401 and closes with feedback on success', async () => {
    flushInitial();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.change-password-trigger').click();
    await fixture.whenStable();

    const dialogComp = TestBed.inject(MatDialog).openDialogs[0].componentInstance as ChangePasswordDialogComponent;
    dialogComp.form.setValue({
      current_password: 'OldPassword123',
      new_password: 'NewPassword456',
      confirm_password: 'WrongConfirm789',
    });
    dialogComp.submit();
    http.expectNone(`${base}/api/v1/profile/change-password`);

    dialogComp.form.controls.confirm_password.setValue('NewPassword456');
    dialogComp.submit();
    const firstPost = http.expectOne(`${base}/api/v1/profile/change-password`);
    expect(firstPost.request.body).toEqual({ current_password: 'OldPassword123', new_password: 'NewPassword456' });
    firstPost.flush(
      { detail: { code: 'INVALID_CURRENT_PASSWORD', message: 'La contraseña actual no es correcta.' } },
      { status: 401, statusText: 'Unauthorized' }
    );
    await fixture.whenStable();
    expect(dialogComp.error()).toBe('La contraseña actual no es correcta.');
    expect(dialogComp.form.controls.new_password.value).toBe('NewPassword456');

    dialogComp.submit();
    http.expectOne(`${base}/api/v1/profile/change-password`).flush({
      message: 'Contraseña actualizada.',
      sessions_revoked: false,
      security_notice: 'Tu sesión actual permanece activa.',
    });
    await vi.waitFor(() => expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(TestBed.inject(NotificationService).show).toHaveBeenCalledWith('Contraseña actualizada. Tu sesión actual permanece activa.', 'success', 6000);
    expect(fixture.nativeElement.querySelector('.feedback')).toBeNull();
  });

  it('updates preferred language directly from section 2 and persists it immediately', async () => {
    flushInitial();
    await fixture.whenStable();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-lang="en"]') as HTMLButtonElement).click();
    const patchReq = http.expectOne(`${base}/api/v1/profile`);
    expect(patchReq.request.method).toBe('PATCH');
    expect(patchReq.request.body).toEqual({ preferred_language: 'en' });
    patchReq.flush({ ...sampleProfile, preferred_language: 'en' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.activeLanguage()).toBe('en');
    expect(TestBed.inject(NotificationService).show).toHaveBeenCalledWith('Idioma actualizado a Inglés (en).', 'success');
    expect(fixture.nativeElement.querySelector('.feedback')).toBeNull();
    expect(TestBed.inject(StorageService).get<string>(PREFERRED_LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('keeps profile independent of subscription billing requests', async () => {
    http.expectOne(`${base}/api/v1/profile`).flush(sampleProfile);
    http.expectNone(req => req.url.includes('/subscriptions/'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.loadedProfile()?.username).toBe('sommelier1');
    expect(fixture.nativeElement.textContent).not.toContain('Invalid Date');
    expect(fixture.nativeElement.querySelector('.manage-plans-link')).toBeTruthy();
  });

  it('notifies a failed language change without altering the saved language or adding an inline card banner', async () => {
    flushInitial(); await fixture.whenStable();
    component.selectLanguage('en');
    http.expectOne(`${base}/api/v1/profile`).flush({ detail: 'Inténtalo más tarde.' }, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    expect(TestBed.inject(NotificationService).show).toHaveBeenCalledWith('Inténtalo más tarde.', 'error');
    expect(component.activeLanguage()).toBe('es');
    expect(component.savingLanguage()).toBe(false);
    expect(fixture.nativeElement.querySelector('.feedback')).toBeNull();
  });
});
