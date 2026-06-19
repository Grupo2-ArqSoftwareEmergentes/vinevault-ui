import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { HeaderComponent } from '../../../../shared/components/header/header';
import { SidebarComponent } from '../../../../shared/components/sidebar/sidebar';

interface SummaryCard {
  label: string;
  value: string;
  icon: string;
  hint: string;
}

interface StatusItem {
  label: string;
  value: string;
  tone: 'success' | 'warning' | 'info';
}

interface ActivityItem {
  title: string;
  description: string;
  time: string;
}

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    HeaderComponent,
    SidebarComponent,
  ],
  templateUrl: './overview.html',
  styleUrl: './overview.css',
})
export class Overview {
  isSidebarOpen = true;

  readonly summaryCards: SummaryCard[] = [
    { label: 'Active sensors', value: '12', icon: 'sensors', hint: 'All sensors reporting normally' },
    { label: 'Open alerts', value: '3', icon: 'warning', hint: 'Two require action today' },
    { label: 'Last sync', value: '1 min ago', icon: 'sync', hint: 'Dashboard refreshed automatically' },
    { label: 'Coverage', value: '98%', icon: 'public', hint: 'Monitoring most spaces' },
  ];

  readonly statusItems: StatusItem[] = [
    { label: 'Gateway', value: 'Online', tone: 'success' },
    { label: 'Backend API', value: 'Healthy', tone: 'success' },
    { label: 'Alert queue', value: 'Needs review', tone: 'warning' },
    { label: 'Forecast model', value: 'Syncing', tone: 'info' },
  ];

  readonly activityItems: ActivityItem[] = [
    {
      title: 'PM2.5 spike detected',
      description: 'The living room exceeded the recommended threshold for a short period.',
      time: '12 minutes ago',
    },
    {
      title: 'Device reconnected',
      description: 'The kitchen sensor came back online after a brief disconnect.',
      time: '34 minutes ago',
    },
    {
      title: 'Thresholds reviewed',
      description: 'Alert thresholds were updated for the workspace zone.',
      time: '2 hours ago',
    },
  ];

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebar(): void {
    this.isSidebarOpen = false;
  }
}
