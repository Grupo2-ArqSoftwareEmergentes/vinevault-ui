import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, defer, finalize, take } from 'rxjs';
import { HeaderComponent } from '../../../../shared/components/header/header';
import { SidebarComponent } from '../../../../shared/components/sidebar/sidebar';
import { WorkspaceContextService, WorkspaceSelection } from '../../../../shared/services/workspace-context.service';
import { WorkspaceAccessService } from '../../../../shared/services/workspace-access.service';
import { workspaceErrorMessage } from '../../../../shared/services/workspace-api.service';
import { WineInventoryItemQueryServiceImpl } from '../../../application/internal/queryservices/wine-inventory-item-query-service.impl';
import { WineInventoryItemCommandServiceImpl } from '../../../application/internal/commandservices/wine-inventory-item-command-service.impl';
import { CreateWineInventoryItemPayload } from '../../../domain/services/wine-inventory-item-command-service';
import { WineInventoryFormModel } from '../../components/wine-inventory-form/wine-inventory-form.model';
import { WineFieldsComponent } from '../../components/wine-inventory-form/wine-fields.component';
import { inventoryQuotaProjection } from '../../../../shared/services/workspace-quota';

@Component({
  selector: 'app-wine-editor-page', standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, HeaderComponent, SidebarComponent, WineFieldsComponent],
  templateUrl: './wine-editor-page.component.html', styleUrl: './wine-editor-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WineEditorPageComponent implements OnInit {
  readonly workspace = inject(WorkspaceContextService);
  readonly access = inject(WorkspaceAccessService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly queries = inject(WineInventoryItemQueryServiceImpl);
  private readonly commands = inject(WineInventoryItemCommandServiceImpl);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly tabs = [
    { label: 'Núcleo y Control', icon: '▦', groups: ['Identificación', 'Compra', 'Negocio'] },
    { label: 'Ficha Enológica', icon: '♧', groups: ['Ficha'] },
    { label: 'Cata y Experiencia', icon: '✧', groups: ['Experiencia'] },
  ] as const;
  activeTab = 0;
  private loadRequest?: Subscription;
  private saveRequest?: Subscription;
  private saveTarget: { spaceId: string; cellarId: string } | null = null;
  private origin: { spaceId: string; cellarId: string } | null = null;
  model = new WineInventoryFormModel();
  itemId: string | null = null;
  isSidebarOpen = window.innerWidth > 768;
  loading = false;
  saving = false;
  loadedItem = false;
  uncertainSave = false;
  contextNotice = '';
  error = '';

  get contextMismatch(): boolean {
    const selection = this.workspace.selection();
    return !!this.origin && (this.origin.spaceId !== selection.space?.id.value || this.origin.cellarId !== selection.cellar?.id.value);
  }
  get canEditForm(): boolean {
    return !!this.workspace.selection().cellar && !!this.access.purpose() && this.access.canInventory() && !this.contextMismatch && (!this.itemId || this.loadedItem) && !this.loading && !this.saving && !this.uncertainSave;
  }
  get inventoryParams() {
    const { space, cellar } = this.workspace.selection();
    return { spaceId: space?.id.value, wineCellarId: cellar?.id.value };
  }
  get quotaProjection() {
    return inventoryQuotaProjection(this.workspace.selection().space, Number(this.model.form.controls['quantity'].value ?? 0), this.model.initialValue?.quantity ?? 0, !!this.itemId);
  }
  get canSave(): boolean { return this.canEditForm && !this.model.form.invalid && !this.quotaProjection?.exceeded; }

  tabHasData(index: number): boolean {
    return this.model.fieldsIn(...this.tabs[index].groups).some(field => {
      const value = this.model.form.controls[field.key].value;
      return value !== null && value !== '' && (!Array.isArray(value) || value.length > 0);
    });
  }
  selectTab(index: number, focus = false): void {
    this.activeTab = index;
    if (focus) this.host.nativeElement.querySelector<HTMLButtonElement>(`#wine-tab-${index}`)?.focus();
    this.host.nativeElement.querySelector('.panel-scroll')?.scrollTo?.({ top: 0 });
  }
  onTabKeydown(event: KeyboardEvent, index: number): void {
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % this.tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + this.tabs.length - 1) % this.tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = this.tabs.length - 1;
    else return;
    event.preventDefault();
    this.selectTab(next, true);
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.loadRequest?.unsubscribe();
      this.itemId = params.get('id');
      this.origin = null;
      this.loadedItem = false;
      this.error = '';
      this.model = new WineInventoryFormModel();
      this.activeTab = 0;
      this.onSelection(this.workspace.selection());
    });
    this.workspace.selectionChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(selection => this.onSelection(selection));
    this.workspace.ensureLoaded();
    this.destroyRef.onDestroy(() => { this.loadRequest?.unsubscribe(); this.saveRequest?.unsubscribe(); });
  }

  private onSelection(selection: WorkspaceSelection): void {
    const { space, cellar } = selection;
    this.model.setPurpose(space?.spaceType ?? null);
    if (this.saving && this.saveTarget && (space?.id.value !== this.saveTarget.spaceId || cellar?.id.value !== this.saveTarget.cellarId || !this.access.canInventory())) {
      this.uncertainSave = true;
      this.saveRequest?.unsubscribe();
      this.contextNotice = 'El contexto cambió durante el guardado. La operación puede haberse completado; vuelve al inventario y compruébalo antes de repetirla.';
    }
    if (this.itemId && !this.origin && space && cellar) {
      // Wait for global URL selection before binding a direct edit link to an item.
      const requested = this.route.snapshot.queryParamMap.get('wineCellarId') ?? this.route.snapshot.queryParamMap.get('cellarId');
      const requestedSpace = this.route.snapshot.queryParamMap.get('spaceId');
      if ((!requested || requested === cellar.id.value) && (!requestedSpace || requestedSpace === space.id.value)) {
        this.origin = { spaceId: space.id.value, cellarId: cellar.id.value };
      }
    }
    if (this.contextMismatch) {
      this.loadRequest?.unsubscribe();
    } else if (this.itemId && this.origin && !this.loadedItem && !this.loading && !this.error) {
      this.loadItem();
    }
    this.cdr.markForCheck();
  }

  loadItem(): void {
    if (!this.origin || !this.itemId || this.contextMismatch || this.loading) return;
    const target = this.origin;
    const itemId = this.itemId;
    this.loading = true;
    this.error = '';
    this.loadRequest = this.queries.getInventoryItemsByWineCellar(target.cellarId).pipe(
      take(1), finalize(() => { this.loading = false; this.cdr.markForCheck(); }), takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: items => {
        if (this.contextMismatch || this.itemId !== itemId) return;
        const item = items.find(item => item.id.value === itemId && item.wineCellarId.value === target.cellarId);
        if (!item) { this.error = 'No se encontró el vino en la cava indicada. No se puede editar.'; return; }
        this.model = new WineInventoryFormModel(item);
        this.model.setPurpose(this.workspace.selection().space?.spaceType ?? null);
        this.loadedItem = true;
      },
      error: error => { this.error = workspaceErrorMessage(error, 'No se pudo cargar el vino.'); },
    });
  }

  save(): void {
    if (!this.canEditForm) return;
    this.model.form.markAllAsTouched();
    if (this.model.form.invalid) {
      const tab = this.tabs.findIndex(item => this.model.fieldsIn(...item.groups).some(field => this.model.form.controls[field.key].invalid));
      this.selectTab(Math.max(0, tab));
      this.cdr.detectChanges();
      this.host.nativeElement.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden]) [aria-invalid="true"]')?.focus();
      return;
    }
    if (this.quotaProjection?.exceeded) { this.selectTab(0, true); return; }
    const { space, cellar } = this.workspace.selection();
    if (!space || !cellar) return;
    const payload = this.model.payload();
    if (this.itemId && !Object.keys(payload).length) { this.returnToInventory(); return; }
    const itemId = this.itemId;
    this.saveTarget = { spaceId: space.id.value, cellarId: cellar.id.value };
    this.saving = true;
    this.error = '';
    this.model.form.disable({ emitEvent: false });
    let confirmed = false;
    this.saveRequest = defer(() => itemId
      ? this.commands.updateInventoryItem(cellar.id.value, itemId, payload)
      : this.commands.createInventoryItem(cellar.id.value, payload as CreateWineInventoryItemPayload)
    ).pipe(
      take(1), finalize(() => {
        if (!confirmed && !this.error) {
          this.uncertainSave = true;
          this.contextNotice = 'El guardado se interrumpió. Comprueba el inventario antes de repetir la operación.';
        }
        this.saving = false;
        this.model.form.enable({ emitEvent: false });
        this.cdr.markForCheck();
      }), takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        confirmed = true;
        if (this.workspace.selection().cellar?.id.value === cellar.id.value && this.workspace.selection().space?.id.value === space.id.value && !this.uncertainSave) void this.router.navigate(['/inventory'], { queryParams: this.inventoryParams });
      },
      error: error => { this.error = workspaceErrorMessage(error, 'No se pudo guardar el vino. Revisa los datos e inténtalo de nuevo.'); },
    });
  }

  returnToInventory(): void {
    if (this.saving) return;
    void this.router.navigate(['/inventory'], { queryParams: this.inventoryParams });
  }
}
