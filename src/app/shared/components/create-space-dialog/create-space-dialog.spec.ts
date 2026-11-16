import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { CreateSpaceDialogComponent } from './create-space-dialog';
import { WorkspaceContextService } from '../../services/workspace-context.service';
import { CreatedWorkspace } from '../../models/workspace-context';

describe('Create Space dialog', () => {
  const createSpace = vi.fn();
  const dialogRef = { close: vi.fn(), disableClose: false };

  beforeEach(() => {
    createSpace.mockReset().mockReturnValue(of({}));
    dialogRef.close.mockReset();
    dialogRef.disableClose = false;
    TestBed.configureTestingModule({ imports: [CreateSpaceDialogComponent], providers: [
      { provide: WorkspaceContextService, useValue: { createSpace } },
      { provide: MatDialogRef, useValue: dialogRef },
    ] });
  });

  for (const purpose of ['COLLECTOR', 'BUSINESS'] as const) {
    it(`requires an explicit purpose and sends a trimmed ${purpose} name`, async () => {
      const fixture = TestBed.createComponent(CreateSpaceDialogComponent);
      await fixture.whenStable();
      const component = fixture.componentInstance;
      component.name = '  My space  ';
      component.submit();
      expect(createSpace).not.toHaveBeenCalled();
      const card = fixture.nativeElement.querySelector(`[data-purpose="${purpose}"]`) as HTMLButtonElement;
      card.click();
      await fixture.whenStable();
      expect(card.getAttribute('aria-pressed')).toBe('true');
      expect(card.classList.contains('selected')).toBe(true);
      expect(fixture.nativeElement.textContent.match(/Plan Free incluido/g)).toHaveLength(2);
      component.submit();
      expect(createSpace).toHaveBeenCalledExactlyOnceWith('My space', purpose);
      expect(dialogRef.close).toHaveBeenCalledOnce();
    });
  }

  it('rejects whitespace names and prevents duplicate submissions or dismissal while pending', async () => {
    const pending = new Subject<CreatedWorkspace>();
    createSpace.mockReturnValue(pending);
    const fixture = TestBed.createComponent(CreateSpaceDialogComponent);
    const component = fixture.componentInstance;
    component.spaceType = 'BUSINESS';
    component.name = '   ';
    component.submit();
    expect(createSpace).not.toHaveBeenCalled();
    component.name = 'Business';
    component.submit();
    component.submit();
    await fixture.whenStable();
    expect(createSpace).toHaveBeenCalledOnce();
    expect(dialogRef.disableClose).toBe(true);
    expect(fixture.nativeElement.querySelector('fieldset').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[mat-dialog-close]').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.primary-action').disabled).toBe(true);
    pending.error(new Error('Offline'));
    await fixture.whenStable();
    expect(component.saving).toBe(false);
    expect(dialogRef.disableClose).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.name).toBe('Business');
    expect(component.spaceType).toBe('BUSINESS');
  });

  it('allows cancellation without submitting', async () => {
    const fixture = TestBed.createComponent(CreateSpaceDialogComponent);
    await fixture.whenStable();
    fixture.nativeElement.querySelector('[mat-dialog-close]').click();
    expect(dialogRef.close).toHaveBeenCalledOnce();
    expect(createSpace).not.toHaveBeenCalled();
  });

  it('unlocks the form after a synchronous creation error', () => {
    createSpace.mockImplementation(() => { throw new Error('Invalid context'); });
    const component = TestBed.createComponent(CreateSpaceDialogComponent).componentInstance;
    component.name = 'Collection';
    component.spaceType = 'COLLECTOR';
    component.submit();
    expect(component.saving).toBe(false);
    expect(component.error).toBeTruthy();
    expect(dialogRef.disableClose).toBe(false);
  });
});
