export type AppearanceSetting = 'system' | 'light' | 'dark';
export type TextSizeSetting   = 'small' | 'medium' | 'large' | 'xl';

export interface UserSettings {
  appearance:                AppearanceSetting;
  textSize:                  TextSizeSetting;
  reduceMotion:              boolean;
  autoSaveDrafts:            boolean;
  confirmBeforePublishing:   boolean;
  automaticAudioTranscription: boolean;
}

export const USER_SETTINGS_STORAGE_KEY = 'breadcrumbs_user_settings_v1';

export const DEFAULT_USER_SETTINGS: UserSettings = {
  appearance:                  'system',
  textSize:                    'medium',
  reduceMotion:                false,
  autoSaveDrafts:              true,
  confirmBeforePublishing:     true,
  automaticAudioTranscription: true,
};

const TEXT_SIZE_TO_ROOT_FONT: Record<TextSizeSetting, string> = {
  small:  '14px',
  medium: '16px',
  large:  '18px',
  xl:     '20px',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeSettings(value: unknown): UserSettings {
  if (!isRecord(value)) return DEFAULT_USER_SETTINGS;

  return {
    appearance:
      value.appearance === 'light' || value.appearance === 'dark' || value.appearance === 'system'
        ? value.appearance
        : DEFAULT_USER_SETTINGS.appearance,
    textSize:
      value.textSize === 'small' || value.textSize === 'medium' ||
      value.textSize === 'large' || value.textSize === 'xl'
        ? value.textSize
        : DEFAULT_USER_SETTINGS.textSize,
    reduceMotion:
      typeof value.reduceMotion === 'boolean'
        ? value.reduceMotion
        : DEFAULT_USER_SETTINGS.reduceMotion,
    autoSaveDrafts:
      typeof value.autoSaveDrafts === 'boolean'
        ? value.autoSaveDrafts
        : DEFAULT_USER_SETTINGS.autoSaveDrafts,
    confirmBeforePublishing:
      typeof value.confirmBeforePublishing === 'boolean'
        ? value.confirmBeforePublishing
        : DEFAULT_USER_SETTINGS.confirmBeforePublishing,
    automaticAudioTranscription:
      typeof value.automaticAudioTranscription === 'boolean'
        ? value.automaticAudioTranscription
        : DEFAULT_USER_SETTINGS.automaticAudioTranscription,
  };
}

export function readUserSettings(): UserSettings {
  if (typeof window === 'undefined') return DEFAULT_USER_SETTINGS;
  try {
    const raw = window.localStorage.getItem(USER_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_USER_SETTINGS;
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
}

export function saveUserSettings(settings: UserSettings): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(USER_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function applyDisplaySettings(settings: UserSettings): void {
  if (typeof document === 'undefined') return;

  // Font size
  document.documentElement.style.fontSize = TEXT_SIZE_TO_ROOT_FONT[settings.textSize];

  // Reduced motion — CSS attribute + reflect for framer-motion consumers
  document.documentElement.dataset.motion = settings.reduceMotion ? 'reduce' : 'default';

  // Theme — 'system' removes the override and lets the CSS media query decide
  if (settings.appearance === 'system') {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = settings.appearance;
  }
}
