export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
}

export interface SignupResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
  email_confirmation_required?: boolean;
}
