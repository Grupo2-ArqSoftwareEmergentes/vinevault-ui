import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { HeaderComponent } from '../../../header/header';
import { SidebarComponent } from '../../../sidebar/sidebar';
import { MockPaymentService } from '../../services/mock-payment.service';
import { CheckoutModalComponent } from '../checkout-modal/checkout-modal';
import { AuthStateService } from '../../../../../iam/presentation/state/auth-state/auth-state';

@Component({
  selector: 'app-plans-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatDialogModule,
    HeaderComponent,
    SidebarComponent
  ],
  templateUrl: './plans-page.component.html',
  styleUrl: './plans-page.component.css'
})
export class PlansPageComponent {
  private readonly paymentService = inject(MockPaymentService);
  private readonly authService = inject(AuthStateService);
  private readonly dialog = inject(MatDialog);

  isSidebarOpen = true;
  newInviteEmail = '';
  inviteError = '';
  inviteSuccess = '';

  readonly subscription = this.paymentService.subscription;
  readonly effectivePlan = this.paymentService.effectivePlan;

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebar(): void {
    this.isSidebarOpen = false;
  }

  getCurrentUser(): string {
    const authState = this.authService.getCurrentState();
    return authState.user ? authState.user.username : 'usuario_demo';
  }

  getCurrentUserEmail(): string {
    const authState = this.authService.getCurrentState();
    return authState.user?.email || 'usuario@demo.com';
  }

  isOwner(): boolean {
    const state = this.subscription();
    const user = this.authService.getCurrentState().user || { username: 'usuario_demo', email: 'usuario@demo.com' };
    return !!(state.plan === 'PREMIUM' && state.ownerUsername === user.username);
  }

  onInviteUser(): void {
    this.inviteError = '';
    this.inviteSuccess = '';

    const email = this.newInviteEmail.trim();
    if (!email) {
      this.inviteError = 'Por favor ingresa un correo o nombre de usuario.';
      return;
    }

    try {
      this.paymentService.inviteUser(email);
      this.inviteSuccess = `¡Usuario "${email}" invitado con éxito! Ahora tiene acceso a la versión Premium.`;
      this.newInviteEmail = '';
    } catch (e: any) {
      this.inviteError = e.message || 'Error al invitar al usuario.';
    }
  }

  onRemoveUser(email: string): void {
    this.inviteError = '';
    this.inviteSuccess = '';
    try {
      this.paymentService.removeInvitedUser(email);
      this.inviteSuccess = `Se ha revocado el acceso premium para "${email}".`;
    } catch (e: any) {
      this.inviteError = e.message || 'Error al remover al usuario.';
    }
  }

  openCheckout(): void {
    this.dialog.open(CheckoutModalComponent, {
      width: '860px',
      maxWidth: '95vw',
      maxHeight: '95vh',
      disableClose: true,
      autoFocus: false
    });
  }

  resetToFree(): void {
    this.inviteError = '';
    this.inviteSuccess = '';
    this.paymentService.resetToFree();
  }
}
