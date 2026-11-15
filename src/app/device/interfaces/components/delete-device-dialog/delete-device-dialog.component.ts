import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DestructiveConfirmationDialogComponent } from '../../../../shared/components/destructive-confirmation-dialog/destructive-confirmation-dialog';

export interface DeleteDeviceDialogData {
  deviceName: string;
}

@Component({
  selector: 'app-delete-device-dialog',
  standalone: true,
  imports: [DestructiveConfirmationDialogComponent],
  templateUrl: './delete-device-dialog.component.html',
  styleUrl: './delete-device-dialog.component.css',
})
export class DeleteDeviceDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<DeleteDeviceDialogComponent>);
  readonly data: DeleteDeviceDialogData = inject(MAT_DIALOG_DATA);

  confirm(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
