import { Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { DestructiveConfirmationDialogComponent } from '../../../../shared/components/destructive-confirmation-dialog/destructive-confirmation-dialog';

@Component({
  selector: 'app-delete-organization-dialog',
  standalone: true,
  imports: [DestructiveConfirmationDialogComponent],
  templateUrl: './delete-organization-dialog.component.html',
  styleUrl: './delete-organization-dialog.component.css',
})
export class DeleteOrganizationDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<DeleteOrganizationDialogComponent>);

  confirm(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
