import { StockAnalysisSseParser } from './stock-analysis-sse.parser';

describe('Stock analysis SSE framing', () => {
  it('buffers partial events and supports multiple events in one chunk', () => {
    const parser = new StockAnalysisSseParser();
    expect(parser.push('event: del')).toEqual([]);
    expect(parser.push('ta\ndata: {"text":"a"}\n')).toEqual([]);
    expect(parser.push('\nevent: delta\ndata: {"text":"b"}\n\n')).toEqual([
      { event: 'delta', data: '{"text":"a"}' }, { event: 'delta', data: '{"text":"b"}' },
    ]);
  });

  it('handles split CRLF, multiline data, comments, and ignored fields', () => {
    const parser = new StockAnalysisSseParser();
    const text = ': heartbeat\r\nid: 7\r\nretry: 1000\r\nevent: delta\r\ndata: {\r\ndata: "text":"vino"}\r\n\r\n';
    const events = [...text].flatMap((char) => parser.push(char));
    expect(events).toEqual([{ event: 'delta', data: '{\n"text":"vino"}' }]);
  });

  it('does not dispatch unterminated events at EOF', () => {
    const parser = new StockAnalysisSseParser();
    expect(parser.push('event: done\ndata: {"result":{}}\n', true)).toEqual([]);
  });

  it('supports CR-only delimiters and resets the event type after dispatch', () => {
    const parser = new StockAnalysisSseParser();
    expect(parser.push('event: delta\rdata: first\r\rdata: second\r\r', true)).toEqual([
      { event: 'delta', data: 'first' }, { event: 'message', data: 'second' },
    ]);
  });
});
