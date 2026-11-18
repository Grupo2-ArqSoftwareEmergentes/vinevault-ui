import { FormControl, FormRecord, Validators, ValidatorFn } from '@angular/forms';
import { SpaceType } from '../../../../device/domain/model/valueobjects/space-access';
import { CreateWineInventoryItemPayload, UpdateWineInventoryItemPayload } from '../../../domain/services/wine-inventory-item-command-service';
import { WineFormField, wineFormFields } from './wine-form-fields';

type FieldValue = string | number | boolean | readonly string[] | null;

/** One form and one diff strategy for both purposes. Visibility never clears values. */
export class WineInventoryFormModel {
  readonly form = new FormRecord<FormControl<FieldValue>>({});
  purpose: SpaceType | null = null;
  tagDraft = '';
  tagError = '';

  constructor(readonly initialValue?: CreateWineInventoryItemPayload) {
    for (const field of wineFormFields) {
      const value = initialValue?.[field.key] ?? (field.key === 'name' ? '' : field.key === 'quantity' ? 1 : null);
      this.form.addControl(field.key, new FormControl<FieldValue>(value));
    }
    this.setPurpose(null);
  }

  get visibleFields(): readonly WineFormField[] {
    return wineFormFields.filter(field => !field.purpose || field.purpose === this.purpose).map(field => {
      if (field.key === 'purchasePrice') return { ...field, label: this.purpose === 'BUSINESS' ? 'Costo unitario' : 'Precio pagado' };
      // The shared backend notes field holds Business sales guidance, not a fabricated API property.
      if (field.key === 'occasionNotes' && this.purpose === 'BUSINESS') return { ...field, label: 'Argumento de venta rápido' };
      if (field.key === 'occasionNotes') return { ...field, label: 'Notas de cata' };
      if (field.key === 'companyNotes' && this.purpose === 'BUSINESS') return { ...field, label: 'Notas de empresa' };
      return field;
    });
  }

  fieldsIn(...groups: string[]): readonly WineFormField[] { return this.visibleFields.filter(field => groups.includes(field.group)); }

  setPurpose(purpose: SpaceType | null): void {
    this.purpose = purpose;
    const visible = new Set(this.visibleFields.map(field => field.key));
    for (const field of wineFormFields) {
      const control = this.form.controls[field.key];
      control.setValidators(visible.has(field.key) ? this.validators(field) : []);
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  get tags(): readonly string[] { return (this.form.controls['aromaTags'].value as readonly string[] | null) ?? []; }
  addTag(): void {
    const tag = this.tagDraft.trim();
    this.tagError = '';
    if (!tag || tag.length > 64 || this.tags.length >= 50) { this.tagError = 'Usa un aroma de 1–64 caracteres (máximo 50 aromas).'; return; }
    this.form.controls['aromaTags'].setValue([...this.tags, tag]);
    this.form.controls['aromaTags'].markAsDirty();
    this.tagDraft = '';
  }
  removeTag(index: number): void { this.form.controls['aromaTags'].setValue(this.tags.filter((_, i) => i !== index)); this.form.controls['aromaTags'].markAsDirty(); }
  clear(key: string): void { this.form.controls[key].setValue(null); this.form.controls[key].markAsDirty(); }

  private validators(field: WineFormField): ValidatorFn[] {
    const validators: ValidatorFn[] = [];
    if (field.key === 'name') validators.push(Validators.required, Validators.pattern(/\S/));
    if (field.key === 'quantity') validators.push(Validators.required);
    if (['decimal', 'integer', 'slider'].includes(field.kind ?? '')) {
      validators.push(Validators.min(field.min ?? 0), Validators.max(field.max ?? 2147483647),
        Validators.pattern(field.kind === 'integer' ? /^\d+$/ : /^\d+(\.\d{1,2})?$/));
    } else if (!field.kind || field.kind === 'notes') validators.push(Validators.maxLength(field.maxLength ?? 255));
    if (field.key === 'vintage') validators.push(Validators.pattern(/^(NV|\d{4})$/));
    if (field.kind === 'window') validators.push(Validators.maxLength(255), control => {
      const value = control.value;
      // Existing free-text windows remain readable/editable without rewriting them.
      if (typeof value !== 'string' || value === this.initialValue?.consumptionWindow || !value.includes('–')) return null;
      const [from, until] = value.split('–').map(bound => bound.trim());
      return (!from || /^\d{4}$/.test(from)) && (!until || /^\d{4}$/.test(until))
        && (!from || !until || Number(from) <= Number(until)) ? null : { window: true };
    });
    if (field.kind === 'date') validators.push(control => {
      const value = control.value as string | null;
      if (!value) return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { date: true };
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? null : { date: true };
    });
    return validators;
  }

  private normalize(value: unknown): unknown { return typeof value === 'string' ? value.trim() || null : value; }

  payload(): UpdateWineInventoryItemPayload {
    const value = this.form.getRawValue();
    const entries = this.visibleFields.map(field => {
      let next = this.normalize(value[field.key]);
      if (field.kind === 'integer' && next !== null) next = Number(next);
      if ((field.kind === 'decimal' || field.kind === 'slider') && next !== null) next = String(next);
      return [field.key, next] as const;
    }).filter(([key, next]) => {
      if (!this.initialValue) return key === 'name' || key === 'quantity' || next !== null;
      return JSON.stringify(this.normalize(this.initialValue[key] ?? null)) !== JSON.stringify(next);
    });
    return Object.fromEntries(entries) as UpdateWineInventoryItemPayload;
  }
}
