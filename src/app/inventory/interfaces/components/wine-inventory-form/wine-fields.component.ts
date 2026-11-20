import { I18nModule } from '../../../../core/i18n/i18n.module';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, TemplateRef } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { WineInventoryFormModel } from './wine-inventory-form.model';
import { WineFormField } from './wine-form-fields';

@Component({
  selector: 'app-wine-fields', standalone: true, imports: [I18nModule, CommonModule, ReactiveFormsModule],
  templateUrl: './wine-fields.component.html', styleUrl: './wine-fields.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WineFieldsComponent {
  @Input({ required: true }) model!: WineInventoryFormModel;
  @Input({ required: true }) fields!: readonly WineFormField[];
  @Input() compact = false;
  @Input() nameAction: TemplateRef<unknown> | null = null;
  trackField(_index: number, field: WineFormField): string { return field.key; }
  hasValue(field: WineFormField): boolean {
    const value = this.model.form.controls[field.key].value;
    return value !== null && value !== '' && (!Array.isArray(value) || value.length > 0);
  }
  get windowBounds(): readonly string[] | null {
    const value = this.model.form.controls['consumptionWindow'].value;
    if (!value) return ['', ''];
    const match = /^(.*?)\s*–\s*(.*?)$/.exec(String(value).trim());
    return match ? [match[1], match[2]] : null;
  }
  setWindowBound(index: number, value: string): void {
    const bounds = [...(this.windowBounds ?? ['', ''])];
    bounds[index] = value.trim();
    const control = this.model.form.controls['consumptionWindow'];
    control.setValue(bounds.some(Boolean) ? bounds.join(' – ') : null);
    control.markAsDirty();
    control.markAsTouched();
  }
}
