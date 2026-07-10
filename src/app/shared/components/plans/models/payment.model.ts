export interface SubscriptionState {
  plan: 'FREE' | 'PREMIUM';
  status: 'ACTIVE' | 'INACTIVE';
  usersLimit: number;
  transactionId?: string;
  ownerUsername?: string;
  invitedUsers?: string[]; // Emails or usernames of invited/delegated users
}

export interface PaymentDetails {
  cardholderName: string;
  cardNumber: string;
  expirationDate: string;
  cvv: string;
}
