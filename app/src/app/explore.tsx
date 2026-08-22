import { Redirect } from 'expo-router';

/** Legacy starter route retained only so old links land on a real product screen. */
export default function ExploreRedirect() {
  return <Redirect href="/settings" />;
}
