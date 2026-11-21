import { NgModule, Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService, TranslationParams } from './i18n.service';

@Pipe({ name: 't', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  transform(source: string | null | undefined, params?: TranslationParams): string {
    return this.i18n.t(source, params);
  }
}

@Pipe({ name: 'localizedDate', standalone: true, pure: false })
export class LocalizedDatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  transform(value: string | number | Date | null | undefined, format?: string): string {
    return this.i18n.date(value, format);
  }
}

@NgModule({
  imports: [TranslatePipe, LocalizedDatePipe],
  exports: [TranslatePipe, LocalizedDatePipe],
})
export class I18nModule {}
