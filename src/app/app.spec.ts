import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app';
import { Router, provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { of } from 'rxjs';
import { WorkspaceContextService } from './shared/services/workspace-context.service';
import { AssistantService } from './assistant/assistant.service';

@Component({ standalone: true, template: '' })
class ShellTestPage {}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter(['overview', 'inventory', 'login'].map(path => ({ path, component: ShellTestPage }))),
        { provide: WorkspaceContextService, useValue: { selection: () => ({ space: null, cellar: null }), selectionChanges: of({ space: null, cellar: null }) } },
        { provide: AssistantService, useValue: { chat: () => of() } },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the application shell', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('keeps one widget across main views and hides it on public routes', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/overview');
    await fixture.whenStable();
    const widget = fixture.nativeElement.querySelector('app-assistant-widget');
    expect(widget).toBeTruthy();
    widget.querySelector('.assistant-trigger').click();
    await router.navigateByUrl('/inventory');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-assistant-widget')).toBe(widget);
    expect(widget.querySelector('[role="dialog"]')).toBeTruthy();
    await router.navigateByUrl('/login');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-assistant-widget')).toBeNull();
  });
});
