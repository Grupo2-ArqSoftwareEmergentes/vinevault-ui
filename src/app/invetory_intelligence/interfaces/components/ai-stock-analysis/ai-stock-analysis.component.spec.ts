import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AIStockAnalysisComponent } from './ai-stock-analysis.component';
import { InventoryIntelligenceCommandServiceImpl } from '../../../application/internal/commandservices/inventory-intelligence-command-service.impl';
import { AnalysisResult } from '../../../domain/model/entities/analysis-result.model';

const result: AnalysisResult = { id: 'analysis-1', analysisType: 'stock', wineCellarId: 'cellar-1', content: '## Cellar recommendations\n\nKeep your **Malbec** in stock.', tokensUsed: 120, createdAt: '2026-11-15T00:00:00Z' };

describe('AI inventory analysis', () => {
  let fixture: ComponentFixture<AIStockAnalysisComponent>;
  const analyze = vi.fn(() => of(result));

  beforeEach(async () => {
    analyze.mockReset().mockReturnValue(of(result));
    await TestBed.configureTestingModule({
      imports: [AIStockAnalysisComponent],
      providers: [{ provide: InventoryIntelligenceCommandServiceImpl, useValue: { analyzeStock: analyze } }],
    }).compileComponents();
    fixture = TestBed.createComponent(AIStockAnalysisComponent);
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
    const pending = new Subject<AnalysisResult>();
    analyze.mockReturnValueOnce(pending);
    fixture.nativeElement.querySelector('.ai-analyze-btn').click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.ai-analyze-btn').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('analyzing your inventory');
    fixture.componentInstance.runAnalysis();
    expect(analyze).toHaveBeenCalledOnce();
    pending.next(result);
    pending.complete();
    await fixture.whenStable();
    fixture.componentRef.setInput('wineCellarId', 'cellar-2');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.glass-container')).toBeNull();
  });

  it('discards a pending analysis from the previous cellar', async () => {
    const pending = new Subject<AnalysisResult>();
    analyze.mockReturnValueOnce(pending);
    fixture.nativeElement.querySelector('.ai-analyze-btn').click();
    await fixture.whenStable();
    fixture.componentRef.setInput('wineCellarId', 'cellar-2');
    await fixture.whenStable();
    pending.next(result);
    pending.complete();
    expect(fixture.componentInstance.analysisResult).toBeNull();
    expect(fixture.componentInstance.loading).toBe(false);
  });
});
