export interface SseMessage { event: string; data: string; }

/** HTTP chunks are not event boundaries. Keep partial lines/events across reads. */
export class StockAnalysisSseParser {
  private buffer = '';
  private event = 'message';
  private data: string[] = [];

  push(text: string, end = false): SseMessage[] {
    this.buffer += text;
    const messages: SseMessage[] = [];
    while (true) {
      const index = this.buffer.search(/[\r\n]/);
      if (index < 0) break;
      const separator = this.buffer[index];
      // A CR at the end may be the first half of a split CRLF.
      if (separator === '\r' && index === this.buffer.length - 1 && !end) break;
      const line = this.buffer.slice(0, index);
      const width = separator === '\r' && this.buffer[index + 1] === '\n' ? 2 : 1;
      this.buffer = this.buffer.slice(index + width);
      if (!line) {
        if (this.data.length) messages.push({ event: this.event, data: this.data.join('\n') });
        this.event = 'message';
        this.data = [];
      } else if (!line.startsWith(':')) {
        const colon = line.indexOf(':');
        const field = colon < 0 ? line : line.slice(0, colon);
        let value = colon < 0 ? '' : line.slice(colon + 1);
        if (value.startsWith(' ')) value = value.slice(1);
        if (field === 'event') this.event = value || 'message';
        if (field === 'data') this.data.push(value);
      }
    }
    // EOF does not dispatch an event that never received its blank-line delimiter.
    return messages;
  }
}
