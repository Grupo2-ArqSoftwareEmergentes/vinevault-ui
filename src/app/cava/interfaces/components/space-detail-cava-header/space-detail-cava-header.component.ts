import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Space } from '../../../../device/domain/services/device-query-service';

@Component({
  selector: 'app-space-detail-cava-header',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './space-detail-cava-header.component.html',
  styleUrl: './space-detail-cava-header.component.css',
})
export class SpaceDetailCavaHeaderComponent {
  @Input() space: Space | null = null;
  @Output() createCavaRequested = new EventEmitter<void>();

  requestCreateCava(): void {
    this.createCavaRequested.emit();
  }
}
