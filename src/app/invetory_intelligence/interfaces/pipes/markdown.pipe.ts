import { Pipe, PipeTransform } from '@angular/core';
import { marked } from 'marked';

@Pipe({
  name: 'markdown',
  standalone: true,
})
export class MarkdownPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    try {
      const html = marked.parse(value) as string;
      // Keep Angular's innerHTML sanitization for untrusted model output.
      return html;
    } catch (e) {
      console.error('Error rendering markdown:', e);
      return value;
    }
  }
}
