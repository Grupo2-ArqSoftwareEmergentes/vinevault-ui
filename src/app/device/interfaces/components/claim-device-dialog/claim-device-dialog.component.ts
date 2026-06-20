import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

export type ClaimDeviceDialogResult = Readonly<{
  claimToken: string;
}>;

@Component({
  selector: 'app-claim-device-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './claim-device-dialog.component.html',
  styleUrl: './claim-device-dialog.component.css',
})
export class ClaimDeviceDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ClaimDeviceDialogComponent, ClaimDeviceDialogResult | undefined>);
  private readonly fb = inject(FormBuilder);

  form: FormGroup = this.fb.group({
    claimToken: [
      '',
      [
        Validators.required,
        Validators.pattern(/(^[A-Z0-9]{4}-[A-Z0-9]{4}$)|(^[A-Za-z0-9_-]{20,}$)/),
      ],
    ],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.dialogRef.close({
      claimToken: this.form.value.claimToken as string,
    });
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}
