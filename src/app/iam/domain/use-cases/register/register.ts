import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthRepository } from '../../../data/repositories/auth-repository/auth-repository';
import { RegisterPayload, User } from '../../models/user';

@Injectable({
  providedIn: 'root',
})
export class RegisterUseCase {
  constructor(private authRepository: AuthRepository) {}

  execute(payload: RegisterPayload): Observable<User> {
    return this.authRepository.register(payload);
  }
}
