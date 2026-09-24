import * as Linking from 'expo-linking';

import { env } from '@/lib/env';
import { isInviteToken } from './invite';

export function createInviteLink(token: string): string {
  if (!isInviteToken(token)) throw new Error('INVALID_INVITE_TOKEN');
  if (env.appLinkOrigin) return new URL(`/invite/${token}`, `${env.appLinkOrigin}/`).toString();
  return Linking.createURL(`/invite/${token}`);
}
