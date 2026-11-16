import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ManagementBackLinkComponent } from './management-back-link';

describe('Management return navigation', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [ManagementBackLinkComponent],
    providers: [provideRouter([
      { path: 'spaces', component: ManagementBackLinkComponent },
      { path: 'overview', component: ManagementBackLinkComponent },
    ])],
  }));

  it('returns to spaces even without prior application history', async () => {
    const fixture = TestBed.createComponent(ManagementBackLinkComponent);
    await fixture.whenStable();
    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/spaces');
    expect(link.getAttribute('aria-label')).toBe('Volver a espacios');
    expect(link.textContent).toContain('Volver');
    link.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/spaces');
  });

  it('supports a parent destination for the spaces management page', async () => {
    const fixture = TestBed.createComponent(ManagementBackLinkComponent);
    fixture.componentRef.setInput('destination', '/overview');
    fixture.componentRef.setInput('label', 'Volver al resumen');
    await fixture.whenStable();
    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('aria-label')).toBe('Volver al resumen');
    link.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/overview');
  });
});
