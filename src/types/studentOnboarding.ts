export interface StudentCreationResponse {
  success: boolean;
  message?: string;
  student: { id: string; userId: string; name?: string };
  invitationStatus?: string;
  emailError?: string | null;
  emailSent?: boolean;
  invitationPersistenceFailed?: boolean;
  invitationPersistenceWarning?: string | null;
}
export interface StudentInvitationResponse {
  success: boolean;
  message?: string;
  invitationStatus?: string;
  emailError?: string | null;
  emailSent?: boolean;
  invitationPersistenceFailed?: boolean;
  invitationPersistenceWarning?: string | null;
}
