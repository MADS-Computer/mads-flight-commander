export type Role = 'operator' | 'observer';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  avatarUrl: string | null;
  createdAt: string;
}
