import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, finalize, of } from 'rxjs';

import { InventoryIntelligenceCommandServiceImpl } from '../../../application/internal/commandservices/inventory-intelligence-command-service.impl';
import { AnalysisResult } from '../../../domain/model/entities/analysis-result.model';
import { MarkdownPipe } from '../../pipes/markdown.pipe';
import { extractApiErrorMessage } from '../../../../device/interfaces/rest/transform/extract-api-error-message.transform';

@Component({
  selector: 'app-ai-stock-analysis',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MarkdownPipe],
  templateUrl: './ai-stock-analysis.component.html',
  styleUrl: './ai-stock-analysis.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AIStockAnalysisComponent implements OnChanges {
  private readonly commandService = inject(InventoryIntelligenceCommandServiceImpl);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) wineCellarId!: string;

  loading = false;
  error = '';
  analysisResult: AnalysisResult | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['wineCellarId']) {
      // Si cambia la cava, reseteamos el resultado anterior y los errores
      this.analysisResult = null;
      this.error = '';
      this.cdr.markForCheck();
    }
  }

  runAnalysis(): void {
    if (!this.wineCellarId || this.loading) return;

    this.loading = true;
    this.error = '';
    this.analysisResult = null;
    this.cdr.markForCheck();

    this.commandService
      .analyzeStock(this.wineCellarId)
      .pipe(
        catchError((err: unknown) => {
          this.error = extractApiErrorMessage(err, 'No se pudo realizar el análisis de inventario en este momento.');
          this.cdr.markForCheck();
          return of(null);
        }),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((result) => {
        if (result) {
          this.analysisResult = result;
        }
        this.cdr.markForCheck();
      });
  }
}
