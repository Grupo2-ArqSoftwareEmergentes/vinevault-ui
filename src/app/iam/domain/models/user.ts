export interface User {
  id?: string | number;
  username: string;
  email?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  token?: string;
}
