import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

export interface EditNameDialogData {
  currentValue: string;
  title: string;
  fieldLabel: string;
  placeholder: string;
}

@Component({
  selector: 'app-edit-name-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './edit-name-dialog.component.html',
  styleUrl: './edit-name-dialog.component.css',
})
export class EditNameDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<EditNameDialogComponent>);
  private readonly fb = inject(FormBuilder);
  readonly data: EditNameDialogData = inject(MAT_DIALOG_DATA);

  form: FormGroup = this.fb.group({
    value: [this.data.currentValue ?? '', [Validators.required, Validators.minLength(1)]],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.value.value as string);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
