import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth/auth-guard';

// IAM Pages
import { LoginComponent } from './iam/presentation/pages/login/login';
import { RegisterComponent } from './iam/presentation/pages/register/register';
import { Overview } from './analytics/interfaces/pages/overview/overview';
import { SpaceDevicesPageComponent } from './device/interfaces/pages/space-devices-page/space-devices-page.component';
import { AlertsPageComponent } from './alerts/interfaces/pages/alerts-page/alerts-page.component';
import { CavasPageComponent } from './cava/interfaces/pages/cavas-page/cavas-page.component';
import { InventoryPageComponent } from './inventory/interfaces/pages/inventory-page/inventory-page.component';
import { PlansPageComponent } from './shared/components/plans/components/plans-page/plans-page.component';
import { OnboardingComponent } from './iam/presentation/pages/onboarding/onboarding';
import { workspaceGuard } from './core/guards/workspace/workspace-guard';
import { OnboardingIntentComponent } from './iam/presentation/pages/onboarding-intent/onboarding-intent';
import { signupIntentGuard } from './core/guards/workspace/signup-intent-guard';
import { SpacesManagementComponent } from './shared/pages/spaces-management/spaces-management';

export const routes: Routes = [
  { path: '', redirectTo: '/overview', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'onboarding/intent', component: OnboardingIntentComponent },
  { path: 'register', component: RegisterComponent, canActivate: [signupIntentGuard] },
  { path: 'onboarding', component: OnboardingComponent, canActivate: [AuthGuard, workspaceGuard] },
  { path: 'spaces', component: SpacesManagementComponent, canActivate: [AuthGuard] },
  {
    path: 'overview',
    component: Overview,
    canActivate: [AuthGuard, workspaceGuard]
  },
  {
    path: 'devices',
    component: SpaceDevicesPageComponent,
    canActivate: [AuthGuard, workspaceGuard]
  },
  {
    path: 'alerts',
    component: AlertsPageComponent,
    canActivate: [AuthGuard, workspaceGuard]
  },
  {
    path: 'cavas',
    component: CavasPageComponent,
    canActivate: [AuthGuard, workspaceGuard]
  },
  {
    path: 'inventory',
    component: InventoryPageComponent,
    canActivate: [AuthGuard, workspaceGuard]
  },
  {
    path: 'subscription',
    component: PlansPageComponent,
    canActivate: [AuthGuard, workspaceGuard]
  },
  { path: 'profile', redirectTo: '/overview', pathMatch: 'full' },
  { path: '**', redirectTo: '/overview' }
];
