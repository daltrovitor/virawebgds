export const locales = ['pt-BR', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'pt-BR';

export const localeNames: Record<Locale, string> = {
    'pt-BR': 'Português',
    'en': 'English',
};

export const localeShortNames: Record<Locale, string> = {
    'pt-BR': 'PT',
    'en': 'EN',
};
