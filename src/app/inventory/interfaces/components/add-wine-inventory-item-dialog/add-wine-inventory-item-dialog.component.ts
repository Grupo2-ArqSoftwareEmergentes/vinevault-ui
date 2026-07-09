import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

import { CreateWineInventoryItemPayload } from '../../../domain/services/wine-inventory-item-command-service';

export type AddWineInventoryItemDialogData = Readonly<{
  title: string;
  submitLabel: string;
  initialValue?: Readonly<{
    wineName: string;
    wineType: string;
    ageYears: number;
    quantity: number;
  }>;
}>;

@Component({
  selector: 'app-add-wine-inventory-item-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './add-wine-inventory-item-dialog.component.html',
  styleUrl: './add-wine-inventory-item-dialog.component.css',
})
export class AddWineInventoryItemDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<AddWineInventoryItemDialogComponent>);
  private readonly fb = inject(FormBuilder);
  readonly data: AddWineInventoryItemDialogData = inject(MAT_DIALOG_DATA);

  readonly form = this.fb.group({
    wineName: [this.data.initialValue?.wineName ?? '', [Validators.required, Validators.minLength(1)]],
    wineType: [this.data.initialValue?.wineType ?? '', [Validators.required, Validators.minLength(1)]],
    ageYears: [this.data.initialValue?.ageYears ?? 0, [Validators.required, Validators.min(0)]],
    quantity: [this.data.initialValue?.quantity ?? 1, [Validators.required, Validators.min(1)]],
  });

  submit(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const payload: CreateWineInventoryItemPayload = {
      wineName: (value.wineName ?? '').trim(),
      wineType: (value.wineType ?? '').trim(),
      ageYears: Number(value.ageYears ?? 0),
      quantity: Number(value.quantity ?? 0),
    };
    this.dialogRef.close(payload);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
