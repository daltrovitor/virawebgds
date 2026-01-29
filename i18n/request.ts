import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale, type Locale } from './config';

// Import messages statically to avoid webpack dynamic import issues
import ptBRMessages from '../messages/pt-BR.json';
import enMessages from '../messages/en.json';

const messages: Record<Locale, typeof ptBRMessages> = {
    'pt-BR': ptBRMessages,
    'en': enMessages
};

export default getRequestConfig(async ({ requestLocale }) => {
    // Validate that the incoming locale is supported
    let locale = await requestLocale;

    if (!locale || !locales.includes(locale as Locale)) {
        locale = defaultLocale;
    }

    return {
        locale,
        messages: messages[locale as Locale]
    };
});
