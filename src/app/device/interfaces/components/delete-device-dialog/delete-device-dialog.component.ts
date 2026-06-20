import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface DeleteDeviceDialogData {
  deviceName: string;
}

@Component({
  selector: 'app-delete-device-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
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
