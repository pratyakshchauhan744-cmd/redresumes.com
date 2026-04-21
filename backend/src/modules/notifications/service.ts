export async function sendNotification(userId: string, message: string): Promise<void> {
  // Replace with email/SMS/push providers in production.
  console.log(`[notification] user=${userId} message=${message}`);
}
