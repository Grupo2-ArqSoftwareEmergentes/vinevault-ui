import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';

import { Device } from '../../../../device/domain/services/device-query-service';

export type LinkDeviceDialogData = Readonly<{
  devices: readonly Device[];
  currentDeviceId: string | null;
}>;

@Component({
  selector: 'app-link-device-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatRadioModule],
  templateUrl: './link-device-dialog.component.html',
  styleUrl: './link-device-dialog.component.css',
})
export class LinkDeviceDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<LinkDeviceDialogComponent>);
  readonly data: LinkDeviceDialogData = inject(MAT_DIALOG_DATA);

  selectedDeviceId: string | null = this.data.currentDeviceId;

  submit(): void {
    if (!this.selectedDeviceId) return;
    this.dialogRef.close(this.selectedDeviceId);
  }

  cancel(): void {
    this.dialogRef.close();
  }

  trackByDeviceId(_: number, device: Device): string {
    return device.id.value;
  }
}
