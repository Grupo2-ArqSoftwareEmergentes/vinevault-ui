import { Component, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { OverlayContainer } from '@angular/cdk/overlay';
import { vi } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { DESTRUCTIVE_DIALOG_CONFIG, DestructiveConfirmationDialogComponent } from './destructive-confirmation-dialog';

@Component({ standalone: true, template: '<button (click)="open()">Open confirmation</button>' })
class DialogTestHost {
  private readonly dialog = inject(MatDialog);
  ref!: MatDialogRef<DestructiveConfirmationDialogComponent, boolean>;
  open(): void {
    this.ref = this.dialog.open(DestructiveConfirmationDialogComponent, {
      ...DESTRUCTIVE_DIALOG_CONFIG,
      enterAnimationDuration: 0,
      exitAnimationDuration: 0,
      data: { title: 'Delete Space', description: 'Its cellars and inventory will also be deleted.' },
    });
  }
}

describe('Shared destructive confirmation dialog', () => {
  let fixture: ComponentFixture<DialogTestHost>;
  let overlay: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [DialogTestHost, DestructiveConfirmationDialogComponent] });
    fixture = TestBed.createComponent(DialogTestHost);
    await fixture.whenStable();
    fixture.nativeElement.querySelector('button').click();
    await firstValueFrom(fixture.componentInstance.ref.afterOpened());
    await fixture.whenStable();
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
  });

  afterEach(() => TestBed.inject(MatDialog).closeAll());

  it('renders the shared panel, backdrop, warning icon, and safe initial focus', () => {
    expect(overlay.querySelector('.destructive-confirmation-dialog')).toBeTruthy();
    expect(overlay.querySelector('.destructive-confirmation-backdrop')).toBeTruthy();
    expect(overlay.querySelector('[role="alertdialog"]')).toBeTruthy();
    expect(overlay.querySelector('h2')?.textContent).toBe('Delete Space');
    expect(overlay.querySelector('.destructive-description')?.textContent).toContain('cellars and inventory');
    expect(overlay.querySelector('svg')?.parentElement?.getAttribute('aria-hidden')).toBe('true');
    expect(document.activeElement).toBe(overlay.querySelector('.destructive-cancel'));
  });

  for (const [button, result] of [['.destructive-cancel', false], ['.destructive-delete', true]] as const) {
    it(`returns ${result} and closes from ${button}`, async () => {
      const closed = vi.fn();
      fixture.componentInstance.ref.afterClosed().subscribe(closed);
      const completed = firstValueFrom(fixture.componentInstance.ref.afterClosed());
      overlay.querySelector<HTMLButtonElement>(button)!.click();
      await completed;
      await fixture.whenStable();
      expect(closed).toHaveBeenCalledExactlyOnceWith(result);
      expect(overlay.querySelector('.destructive-confirmation-dialog')).toBeNull();
    });
  }

  it('dismisses from the backdrop without confirming deletion', async () => {
    const closed = vi.fn();
    fixture.componentInstance.ref.afterClosed().subscribe(closed);
    const completed = firstValueFrom(fixture.componentInstance.ref.afterClosed());
    overlay.querySelector<HTMLElement>('.destructive-confirmation-backdrop')!.click();
    await completed;
    await fixture.whenStable();
    expect(closed).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it('dismisses with Escape without confirming deletion', async () => {
    const completed = firstValueFrom(fixture.componentInstance.ref.afterClosed());
    overlay.querySelector('.destructive-cancel')!.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape', keyCode: 27, bubbles: true,
    }));
    expect(await completed).toBeUndefined();
  });
});
