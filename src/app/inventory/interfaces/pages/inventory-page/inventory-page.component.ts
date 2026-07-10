import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

import { HeaderComponent } from '../../../../shared/components/header/header';
import { SidebarComponent } from '../../../../shared/components/sidebar/sidebar';
import { InventorySelectionPanelComponent } from '../../components/inventory-selection-panel/inventory-selection-panel.component';

@Component({
  selector: 'app-inventory-page',
  standalone: true,
  imports: [CommonModule, HeaderComponent, SidebarComponent, InventorySelectionPanelComponent],
  templateUrl: './inventory-page.component.html',
  styleUrl: './inventory-page.component.css',
})
export class InventoryPageComponent {
  isSidebarOpen = true;

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebar(): void {
    this.isSidebarOpen = false;
  }
}
