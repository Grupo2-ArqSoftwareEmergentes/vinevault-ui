import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

@Pipe({
  name: 'markdown',
  standalone: true,
})
export class MarkdownPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    if (!value) return '';
    try {
      const html = marked.parse(value) as string;
      return this.sanitizer.bypassSecurityTrustHtml(html);
    } catch (e) {
      console.error('Error rendering markdown:', e);
      return value;
    }
  }
}
