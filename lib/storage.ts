import AsyncStorage from '@react-native-async-storage/async-storage';

export { AsyncStorage as storage };

export const STORAGE_KEYS = {
  USER_PROFILE:          'userProfile',
  FAVORITES:             'favorites',
  NOTIF:                 'notifSettings',
  URGENT_CHECK_DATE:     'urgentCheckDate',
  NOTIFIED_URGENT_IDS:   'notifiedUrgentIds',
  ONBOARDED:             'onboarded',
  THEME_COLOR:           'themeColor',
  LANGUAGE:              'language',
} as const;
