import { Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { DestructiveConfirmationDialogComponent } from '../../../../shared/components/destructive-confirmation-dialog/destructive-confirmation-dialog';

@Component({
  selector: 'app-delete-space-dialog',
  standalone: true,
  imports: [DestructiveConfirmationDialogComponent],
  templateUrl: './delete-space-dialog.component.html',
  styleUrl: './delete-space-dialog.component.css',
})
export class DeleteSpaceDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<DeleteSpaceDialogComponent>);

  confirm(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
