import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { WineInventoryFormModel } from './wine-inventory-form.model';
import { WineFormField } from './wine-form-fields';

@Component({
  selector: 'app-wine-fields', standalone: true, imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './wine-fields.component.html', styleUrl: './wine-fields.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WineFieldsComponent {
  @Input({ required: true }) model!: WineInventoryFormModel;
  @Input({ required: true }) fields!: readonly WineFormField[];
  trackField(_index: number, field: WineFormField): string { return field.key; }
}
