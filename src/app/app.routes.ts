import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth/auth-guard';

// IAM Pages
import { LoginComponent } from './iam/presentation/pages/login/login';
import { RegisterComponent } from './iam/presentation/pages/register/register';
import { Overview } from './analytics/interfaces/pages/overview/overview';

export const routes: Routes = [
  { path: '', redirectTo: '/overview', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  {
    path: 'overview',
    component: Overview,
    canActivate: [AuthGuard]
  },
  { path: 'profile', redirectTo: '/overview', pathMatch: 'full' },
  { path: '**', redirectTo: '/overview' }
];
