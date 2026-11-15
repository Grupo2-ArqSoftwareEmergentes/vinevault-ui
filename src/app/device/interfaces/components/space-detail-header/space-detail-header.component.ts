import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { WorkspaceSpace as Space } from '../../../../shared/models/workspace-context';

@Component({
  selector: 'app-space-detail-header',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatMenuModule],
  templateUrl: './space-detail-header.component.html',
  styleUrl: './space-detail-header.component.css',
})
export class SpaceDetailHeaderComponent {
  @Input() space: Space | null = null;
  @Output() claimDeviceRequested = new EventEmitter<void>();
  @Output() pairDeviceRequested = new EventEmitter<void>();
  @Output() editSpaceRequested = new EventEmitter<void>();
  @Output() deleteSpaceRequested = new EventEmitter<void>();

  requestClaimDevice(): void {
    this.claimDeviceRequested.emit();
  }

  requestPairDevice(): void {
    this.pairDeviceRequested.emit();
  }

  requestEditSpace(): void {
    this.editSpaceRequested.emit();
  }

  requestDeleteSpace(): void {
    this.deleteSpaceRequested.emit();
  }
}
