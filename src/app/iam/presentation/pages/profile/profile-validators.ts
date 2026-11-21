import { AbstractControl, ValidationErrors } from '@angular/forms';
import { utf8ByteLength } from '../../../domain/models/profile';

export function trimmedMinLength(min: number) {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const trimmed = String(control.value ?? '').trim();
    if (!trimmed) return null;
    return trimmed.length < min ? { trimmedMinLength: { requiredLength: min, actualLength: trimmed.length } } : null;
  };
}

export function trimmedMaxLength(max: number) {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const trimmed = String(control.value ?? '').trim();
    return trimmed.length > max ? { trimmedMaxLength: { requiredLength: max, actualLength: trimmed.length } } : null;
  };
}

export function alphanumericUsername(control: AbstractControl<string>): ValidationErrors | null {
  const trimmed = String(control.value ?? '').trim();
  if (!trimmed) return null;
  return /^[A-Za-z0-9]+$/.test(trimmed) ? null : { alphanumeric: true };
}

export function utf8MaxBytes(maxBytes: number) {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const value = String(control.value ?? '');
    if (!value) return null;
    const bytes = utf8ByteLength(value);
    return bytes > maxBytes ? { maxUtf8Bytes: { maxBytes, actualBytes: bytes } } : null;
  };
}

export function passwordGroupValidator(group: AbstractControl): ValidationErrors | null {
  const current = String(group.get('current_password')?.value ?? '');
  const next = String(group.get('new_password')?.value ?? '');
  const confirm = String(group.get('confirm_password')?.value ?? '');
  const errors: ValidationErrors = {};
  if (next && confirm && next !== confirm) errors['passwordMismatch'] = true;
  if (current && next && current === next) errors['passwordUnchanged'] = true;
  return Object.keys(errors).length ? errors : null;
}
