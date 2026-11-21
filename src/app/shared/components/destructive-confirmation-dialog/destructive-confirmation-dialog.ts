import { I18nModule } from '../../../core/i18n/i18n.module';
import { Component, Input, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslationParams } from '../../../core/i18n/i18n.service';

export interface DestructiveConfirmationData {
  title: string;
  description: string;
  descriptionKey?: string;
  params?: TranslationParams;
}

export const DESTRUCTIVE_DIALOG_CONFIG = {
  width: '448px',
  maxWidth: 'calc(100vw - 32px)',
  panelClass: 'destructive-confirmation-dialog',
  backdropClass: 'destructive-confirmation-backdrop',
  autoFocus: '.destructive-cancel',
  role: 'alertdialog' as const,
};

@Component({
  selector: 'app-destructive-confirmation-dialog',
  standalone: true,
  imports: [I18nModule, MatDialogModule],
  templateUrl: './destructive-confirmation-dialog.html',
})
export class DestructiveConfirmationDialogComponent {
  private readonly data = inject<DestructiveConfirmationData | null>(MAT_DIALOG_DATA, { optional: true });
  readonly dialogRef = inject(MatDialogRef);
  @Input() title = this.data?.title ?? 'Confirm deletion';
  @Input() description = this.data?.description ?? 'This action cannot be undone.';
  @Input() descriptionKey = this.data?.descriptionKey;
  @Input() params = this.data?.params;

  constructor() {
    this.dialogRef.addPanelClass(DESTRUCTIVE_DIALOG_CONFIG.panelClass);
  }
}
