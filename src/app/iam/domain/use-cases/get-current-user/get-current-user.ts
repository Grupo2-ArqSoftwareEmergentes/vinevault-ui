import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthRepository } from '../../../data/repositories/auth-repository/auth-repository';
import { User } from '../../models/user';

@Injectable({
  providedIn: 'root',
})
export class GetCurrentUserUseCase {
  constructor(private authRepository: AuthRepository) {}

  execute(): Observable<User> {
    return this.authRepository.getCurrentUser();
  }
}
