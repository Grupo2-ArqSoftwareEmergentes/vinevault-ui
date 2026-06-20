import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

export type PairDeviceDialogResult = Readonly<{
  hardwareId: string;
}>;

@Component({
  selector: 'app-pair-device-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './pair-device-dialog.component.html',
  styleUrl: './pair-device-dialog.component.css',
})
export class PairDeviceDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<PairDeviceDialogComponent, PairDeviceDialogResult | undefined>);
  private readonly fb = inject(FormBuilder);

  form: FormGroup = this.fb.group({
    hardwareId: ['', [Validators.required, Validators.pattern(/^VINE-[0-9A-Za-z]{4}$/)]],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.dialogRef.close({
      hardwareId: this.form.value.hardwareId as string,
    });
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}
