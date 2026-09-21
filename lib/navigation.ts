import { useRouter } from 'expo-router';

type AppRouter = ReturnType<typeof useRouter>;

export function goBack(router: AppRouter): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}
