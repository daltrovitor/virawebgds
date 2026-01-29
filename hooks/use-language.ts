'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { locales, type Locale } from '@/i18n/config';
import { useCallback } from 'react';

/**
 * Hook utilitário para gerenciar troca de idioma
 * 
 * @example
 * const { locale, changeLocale, locales, isCurrentLocale } = useLanguage();
 * 
 * // Trocar para inglês
 * changeLocale('en');
 * 
 * // Verificar se é o idioma atual
 * isCurrentLocale('pt-BR'); // true ou false
 */
export function useLanguage() {
    const locale = useLocale() as Locale;
    const router = useRouter();
    const pathname = usePathname();

    /**
     * Muda o idioma atual mantendo o usuário na mesma página
     */
    const changeLocale = useCallback((newLocale: Locale) => {
        if (newLocale === locale) return;
        router.replace(pathname, { locale: newLocale });
    }, [locale, pathname, router]);

    /**
     * Alterna entre os idiomas disponíveis
     */
    const toggleLocale = useCallback(() => {
        const currentIndex = locales.indexOf(locale);
        const nextIndex = (currentIndex + 1) % locales.length;
        changeLocale(locales[nextIndex]);
    }, [locale, changeLocale]);

    /**
     * Verifica se o locale fornecido é o atual
     */
    const isCurrentLocale = useCallback((checkLocale: Locale) => {
        return locale === checkLocale;
    }, [locale]);

    /**
     * Retorna o próximo locale na lista
     */
    const getNextLocale = useCallback(() => {
        const currentIndex = locales.indexOf(locale);
        const nextIndex = (currentIndex + 1) % locales.length;
        return locales[nextIndex];
    }, [locale]);

    return {
        /** Locale atual */
        locale,
        /** Todos os locales disponíveis */
        locales,
        /** Muda para um locale específico */
        changeLocale,
        /** Alterna para o próximo locale */
        toggleLocale,
        /** Verifica se é o locale atual */
        isCurrentLocale,
        /** Retorna o próximo locale */
        getNextLocale,
    };
}

export default useLanguage;
