import { I18nModule } from '../../../../core/i18n/i18n.module';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EMPTY, Subscription, catchError, finalize, timer } from 'rxjs';

import { InventoryIntelligenceCommandServiceImpl } from '../../../application/internal/commandservices/inventory-intelligence-command-service.impl';
import { AnalysisResult } from '../../../domain/model/entities/analysis-result.model';
import { StockAnalysisError } from '../../../domain/model/entities/stock-analysis-event.model';
import { MarkdownPipe } from '../../pipes/markdown.pipe';
import { extractApiErrorMessage } from '../../../../device/interfaces/rest/transform/extract-api-error-message.transform';
import { WorkspaceAccessService } from '../../../../shared/services/workspace-access.service';
import { WorkspaceScopeService } from '../../../../shared/services/workspace-scope.service';
import { PlanFeatureNoticeComponent } from '../../../../shared/components/plan-feature-notice/plan-feature-notice';

@Component({
  selector: 'app-ai-stock-analysis',
  standalone: true,
  imports: [I18nModule, CommonModule, MatProgressSpinnerModule, MarkdownPipe, PlanFeatureNoticeComponent],
  templateUrl: './ai-stock-analysis.component.html',
  styleUrl: './ai-stock-analysis.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AIStockAnalysisComponent implements OnChanges {
  private readonly commandService = inject(InventoryIntelligenceCommandServiceImpl);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly access = inject(WorkspaceAccessService);

  @Input({ required: true }) wineCellarId!: string;

  loading = false;
  error = '';
  featureUnavailable = false;
  analysisResult: AnalysisResult | null = null;
  analysisText = '';
  emptyMessage = '';
  incomplete = false;
  retryAfterAt: number | null = null;
  retryBlocked = false;
  private analysisRequest: Subscription | null = null;
  private cooldown: Subscription | null = null;
  private requestId = 0;

  constructor() {
    inject(WorkspaceScopeService).changed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.requestId++;
      this.analysisRequest?.unsubscribe();
      this.loading = false;
      this.analysisResult = null;
      this.analysisText = '';
      this.emptyMessage = '';
      this.incomplete = false;
      this.error = '';
      this.featureUnavailable = false;
      this.cdr.markForCheck();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['wineCellarId']) {
      this.featureUnavailable = false;
      this.requestId++;
      this.analysisRequest?.unsubscribe();
      this.loading = false;
      // Si cambia la cava, reseteamos el resultado anterior y los errores
      this.analysisResult = null;
      this.analysisText = '';
      this.emptyMessage = '';
      this.incomplete = false;
      this.error = '';
      this.cdr.markForCheck();
    }
  }

  runAnalysis(): void {
    if (!this.wineCellarId || this.loading || this.retryBlocked || !this.access.canAnalyze()) return;

    const cellarId = this.wineCellarId;
    const requestId = ++this.requestId;
    const isCurrent = () => this.requestId === requestId && this.wineCellarId === cellarId;

    this.loading = true;
    this.error = '';
    this.featureUnavailable = false;
    this.analysisResult = null;
    this.analysisText = '';
    this.emptyMessage = '';
    this.incomplete = false;
    this.cdr.markForCheck();

    this.analysisRequest = this.commandService
      .analyzeStockStream(cellarId)
      .pipe(
        catchError((err: unknown) => {
          if (!isCurrent()) return EMPTY;
          this.error = err instanceof StockAnalysisError ? err.message : extractApiErrorMessage(err, 'Unable to complete inventory analysis at this time.');
          this.featureUnavailable = err instanceof StockAnalysisError && err.code === 'PLAN_FEATURE_UNAVAILABLE';
          this.incomplete = this.analysisText.length > 0;
          if (err instanceof StockAnalysisError && err.retryAfterAt && err.retryAfterAt > Date.now()) {
            this.retryAfterAt = err.retryAfterAt;
            this.retryBlocked = true;
            this.cooldown?.unsubscribe();
            this.cooldown = timer(err.retryAfterAt - Date.now()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
              this.retryBlocked = false;
              this.retryAfterAt = null;
              this.cdr.markForCheck();
            });
          }
          this.cdr.markForCheck();
          return EMPTY;
        }),
        finalize(() => {
          if (!isCurrent()) return;
          this.loading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => {
        if (!isCurrent()) return;
        if (event.type === 'delta') this.analysisText += event.text;
        else if (event.type === 'done') {
          this.analysisResult = event.result;
          this.analysisText = event.result.content;
          this.loading = false;
        } else {
          this.emptyMessage = event.message;
          this.loading = false;
        }
        this.cdr.markForCheck();
      });
  }
}
