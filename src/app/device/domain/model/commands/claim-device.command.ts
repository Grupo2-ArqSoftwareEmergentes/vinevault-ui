import { SpaceId } from '../valueobjects/space-id.value-object';

export type ClaimDeviceCommand = Readonly<{
  claimToken: string;
  spaceId: SpaceId;
}>;

export const createClaimDeviceCommand = (
  claimToken: string,
  spaceId: SpaceId
): ClaimDeviceCommand => {
  const normalizedClaimToken = claimToken.trim();
  if (normalizedClaimToken.length === 0) {
    throw new Error('Claim token must not be empty');
  }
  return Object.freeze({ claimToken: normalizedClaimToken, spaceId });
};
