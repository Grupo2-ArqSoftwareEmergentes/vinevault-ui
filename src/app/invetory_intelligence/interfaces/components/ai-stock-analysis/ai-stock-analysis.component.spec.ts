import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AIStockAnalysisComponent } from './ai-stock-analysis.component';
import { InventoryIntelligenceCommandServiceImpl } from '../../../application/internal/commandservices/inventory-intelligence-command-service.impl';
import { AnalysisResult } from '../../../domain/model/entities/analysis-result.model';
import { StockAnalysisError, StockAnalysisEvent } from '../../../domain/model/entities/stock-analysis-event.model';
import { WorkspaceScopeService } from '../../../../shared/services/workspace-scope.service';
import { ownerAccess } from '../../../../shared/testing/workspace.fixtures';

const result: AnalysisResult = { id: 'analysis-1', analysisType: 'stock', wineCellarId: 'cellar-1', content: '## Cellar recommendations\n\nKeep your **Malbec** in stock.', tokensUsed: 120, createdAt: '2026-11-15T00:00:00Z' };

describe('AI inventory analysis', () => {
  let fixture: ComponentFixture<AIStockAnalysisComponent>;
  const analyze = vi.fn((_id: string): Observable<StockAnalysisEvent> => of({ type: 'done', result }));

  beforeEach(async () => {
    analyze.mockReset().mockReturnValue(of({ type: 'done', result }));
    await TestBed.configureTestingModule({
      imports: [AIStockAnalysisComponent],
      providers: [{ provide: InventoryIntelligenceCommandServiceImpl, useValue: { analyzeStockStream: analyze } }],
    }).compileComponents();
    fixture = TestBed.createComponent(AIStockAnalysisComponent);
    TestBed.inject(WorkspaceScopeService).activate({ ...ownerAccess, id: { value: 'space-1' }, name: 'Home' });
    fixture.componentRef.setInput('wineCellarId', 'cellar-1');
    await fixture.whenStable();
  });

  it('analyzes the current cava and renders the existing markdown result', async () => {
    expect(fixture.nativeElement.querySelector('.ai-analyze-btn').textContent).toContain('Analyze with AI');
    fixture.nativeElement.querySelector('.ai-analyze-btn').click();
    await fixture.whenStable();
    expect(analyze).toHaveBeenCalledWith('cellar-1');
    expect(fixture.nativeElement.querySelector('.markdown-content h2').textContent).toBe('Cellar recommendations');
    expect(fixture.nativeElement.querySelector('.glass-meta').textContent).toContain('Tokens used: 120');
  });

  it('shows English failure text and retries the same endpoint', async () => {
    analyze.mockReturnValueOnce(throwError(() => new Error('Unavailable')));
    fixture.nativeElement.querySelector('.ai-analyze-btn').click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Unable to complete inventory analysis at this time.');
    const retry = fixture.nativeElement.querySelector('.error-retry-btn') as HTMLButtonElement;
    expect(retry.textContent).toBe('Retry');
    retry.click();
    await fixture.whenStable();
    expect(analyze).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('disables duplicate requests while loading and resets results on cava changes', async () => {
    const pending = new Subject<StockAnalysisEvent>();
    analyze.mockReturnValueOnce(pending);
    fixture.nativeElement.querySelector('.ai-analyze-btn').click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.ai-analyze-btn').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('analyzing your inventory');
    fixture.componentInstance.runAnalysis();
    expect(analyze).toHaveBeenCalledOnce();
    pending.next({ type: 'done', result });
    pending.complete();
    await fixture.whenStable();
    fixture.componentRef.setInput('wineCellarId', 'cellar-2');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.glass-container')).toBeNull();
  });

  it('discards a pending analysis from the previous cellar', async () => {
    const pending = new Subject<StockAnalysisEvent>();
    analyze.mockReturnValueOnce(pending);
    fixture.nativeElement.querySelector('.ai-analyze-btn').click();
    await fixture.whenStable();
    fixture.componentRef.setInput('wineCellarId', 'cellar-2');
    await fixture.whenStable();
    pending.next({ type: 'done', result });
    pending.complete();
    expect(fixture.componentInstance.analysisResult).toBeNull();
    expect(fixture.componentInstance.loading).toBe(false);
  });

  it('renders deltas immediately and replaces them with definitive done content', async () => {
    const pending = new Subject<StockAnalysisEvent>();
    analyze.mockReturnValueOnce(pending);
    fixture.nativeElement.querySelector('.ai-analyze-btn').click();
    pending.next({ type: 'delta', text: 'Primer ' });
    pending.next({ type: 'delta', text: '**fragmento**' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.markdown-content').textContent).toContain('Primer fragmento');
    expect(fixture.componentInstance.loading).toBe(true);
    expect(fixture.nativeElement.querySelector('.ai-analyze-btn').disabled).toBe(true);
    pending.next({ type: 'done', result });
    pending.complete();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.markdown-content').textContent).not.toContain('Primer');
    expect(fixture.componentInstance.analysisResult).toEqual(result);
    expect(fixture.componentInstance.loading).toBe(false);
  });

  it('shows empty-cellar messages without retrying or retaining an old analysis', async () => {
    fixture.nativeElement.querySelector('.ai-analyze-btn').click();
    await fixture.whenStable();
    analyze.mockReturnValueOnce(of({ type: 'empty', message: 'No hay vinos en esta cava para analizar.' }));
    fixture.nativeElement.querySelector('.ai-analyze-btn').click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.empty-analysis').textContent).toContain('No hay vinos');
    expect(fixture.nativeElement.querySelector('.markdown-content')).toBeNull();
    expect(fixture.componentInstance.loading).toBe(false);
    expect(analyze).toHaveBeenCalledTimes(2);
  });

  it('keeps partial output visible and explicitly incomplete after a stream error', async () => {
    const pending = new Subject<StockAnalysisEvent>();
    analyze.mockReturnValueOnce(pending);
    fixture.nativeElement.querySelector('.ai-analyze-btn').click();
    pending.next({ type: 'delta', text: 'Texto parcial' });
    pending.error(new StockAnalysisError('Connection interrupted'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.markdown-content').textContent).toContain('Texto parcial');
    expect(fixture.nativeElement.querySelector('.incomplete-label').textContent).toContain('Incomplete');
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Connection interrupted');
    expect(fixture.componentInstance.loading).toBe(false);
    expect(analyze).toHaveBeenCalledOnce();
  });

  it('sanitizes untrusted HTML while rendering streamed markdown', async () => {
    analyze.mockReturnValueOnce(of({ type: 'delta', text: '<img src="x" onerror="alert(1)"><script>alert(1)</script>\n\n**Safe text**' }));
    fixture.nativeElement.querySelector('.ai-analyze-btn').click();
    await fixture.whenStable();
    const content = fixture.nativeElement.querySelector('.markdown-content') as HTMLElement;
    expect(content.querySelector('script')).toBeNull();
    expect(content.querySelector('img')?.getAttribute('onerror')).toBeNull();
    expect(content.querySelector('strong')?.textContent).toBe('Safe text');
  });

  it('unsubscribes active requests on cellar changes and on destruction', async () => {
    const cancelled = vi.fn();
    analyze.mockImplementation(() => new Observable(() => cancelled));
    fixture.nativeElement.querySelector('.ai-analyze-btn').click();
    fixture.componentRef.setInput('wineCellarId', 'cellar-2');
    await fixture.whenStable();
    expect(cancelled).toHaveBeenCalledOnce();
    fixture.nativeElement.querySelector('.ai-analyze-btn').click();
    fixture.destroy();
    expect(cancelled).toHaveBeenCalledTimes(2);
  });

  it('respects Retry-After without issuing an automatic retry', async () => {
    vi.useFakeTimers();
    try {
      analyze.mockReturnValueOnce(throwError(() => new StockAnalysisError('Quota exhausted', 429, Date.now() + 2000)));
      fixture.componentInstance.runAnalysis();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.ai-analyze-btn').disabled).toBe(true);
      expect(fixture.nativeElement.querySelector('.error-retry-btn').disabled).toBe(true);
      fixture.componentInstance.runAnalysis();
      expect(analyze).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(2000);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.ai-analyze-btn').disabled).toBe(false);
      expect(analyze).toHaveBeenCalledOnce();
    } finally { vi.useRealTimers(); }
  });
});
