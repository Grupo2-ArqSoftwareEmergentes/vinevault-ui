import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, FormRecord, ReactiveFormsModule, Validators, ValidatorFn } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

import { CreateWineInventoryItemPayload, UpdateWineInventoryItemPayload } from '../../../domain/services/wine-inventory-item-command-service';
import { WineFormField, wineFormFields } from './wine-form-fields';

export type AddWineInventoryItemDialogData = Readonly<{
  title: string;
  submitLabel: string;
  initialValue?: CreateWineInventoryItemPayload;
  purpose?: 'COLLECTOR' | 'BUSINESS' | null;
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
  readonly data: AddWineInventoryItemDialogData = inject(MAT_DIALOG_DATA);

  readonly visibleFields = wineFormFields.filter((field) => !field.purpose || field.purpose === (this.data.purpose ?? 'COLLECTOR'));
  readonly groups = [...new Set(this.visibleFields.map((field) => field.group))];
  readonly form = new FormRecord<FormControl<string | number | boolean | readonly string[] | null>>({
    name: new FormControl(this.data.initialValue?.name ?? '', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(255)]),
    quantity: new FormControl(this.data.initialValue?.quantity ?? 1, [Validators.required, Validators.min(0), Validators.max(2147483647), Validators.pattern(/^\d+$/)]),
  });
  tagDraft = '';
  private submitted = false;

  constructor() {
    for (const field of wineFormFields) {
      this.form.addControl(field.key, new FormControl(this.data.initialValue?.[field.key] ?? null,
        this.visibleFields.includes(field) ? this.validators(field) : []));
    }
  }

  fieldsIn(group: string): readonly WineFormField[] { return this.visibleFields.filter((field) => field.group === group); }

  get tags(): readonly string[] { return (this.form.controls['aromaTags'].value as readonly string[] | null) ?? []; }

  addTag(): void {
    const tag = this.tagDraft.trim();
    if (!tag || tag.length > 64 || this.tags.length >= 50) return;
    this.form.controls['aromaTags'].setValue([...this.tags, tag]);
    this.tagDraft = '';
  }

  removeTag(index: number): void { this.form.controls['aromaTags'].setValue(this.tags.filter((_, i) => i !== index)); }

  private validators(field: WineFormField): ValidatorFn[] {
    const validators: ValidatorFn[] = [];
    if (field.kind === 'decimal' || field.kind === 'integer') {
      validators.push(Validators.min(field.min ?? 0), Validators.max(field.max ?? 2147483647),
        Validators.pattern(field.kind === 'integer' ? /^\d+$/ : /^\d+(\.\d{1,2})?$/));
    } else if (!field.kind) validators.push(Validators.maxLength(field.maxLength ?? 255));
    if (field.key === 'vintage') validators.push(Validators.pattern(/^(NV|\d{4})$/));
    if (field.kind === 'date') validators.push((control) => {
      const value = control.value as string | null;
      if (!value) return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { date: true };
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? null : { date: true };
    });
    return validators;
  }

  private normalize(value: unknown): unknown { return typeof value === 'string' ? value.trim() || null : value; }

  submit(): void {
    if (this.form.invalid || this.submitted) return;
    const value = this.form.getRawValue();
    const entries = ['name', 'quantity', ...this.visibleFields.map((field) => field.key)].map((key) => {
      const field = this.visibleFields.find((item) => item.key === key);
      let next = this.normalize(value[key]);
      if ((key === 'quantity' || field?.kind === 'integer') && next !== null) next = Number(next);
      if (field?.kind === 'decimal' && next !== null) next = String(next);
      return [key, next] as const;
    }).filter(([key, next]) => {
      if (!this.data.initialValue) return key === 'name' || key === 'quantity' || next !== null;
      const initial = this.normalize(this.data.initialValue[key as keyof CreateWineInventoryItemPayload] ?? null);
      return JSON.stringify(initial) !== JSON.stringify(next);
    });
    if (this.data.initialValue && !entries.length) { this.dialogRef.close(); return; }
    const payload = Object.fromEntries(entries) as UpdateWineInventoryItemPayload;
    this.submitted = true;
    this.dialogRef.close(payload);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
