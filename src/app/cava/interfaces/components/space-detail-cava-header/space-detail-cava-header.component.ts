import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CanSpaceDirective } from '../../../../shared/directives/can-space.directive';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { WorkspaceSpace as Space } from '../../../../shared/models/workspace-context';
import { hasSpacePermission } from '../../../../device/domain/model/valueobjects/space-access';

@Component({
  selector: 'app-space-detail-cava-header',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, CanSpaceDirective],
  templateUrl: './space-detail-cava-header.component.html',
  styleUrl: './space-detail-cava-header.component.css',
})
export class SpaceDetailCavaHeaderComponent {
  @Input() space: Space | null = null;
  @Output() createCavaRequested = new EventEmitter<void>();

  requestCreateCava(): void {
    if (!hasSpacePermission(this.space, 'CONFIGURE')) return;
    this.createCavaRequested.emit();
  }
}
