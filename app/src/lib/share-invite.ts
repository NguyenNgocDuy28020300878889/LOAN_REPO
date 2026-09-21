import { Share } from 'react-native';

export async function shareInviteLink(url: string, title: string, instructions: string) {
  await Share.share({ message: `${instructions}\n\n${url}`, title });
}
