"use client";

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { locales, localeShortNames, type Locale } from '@/i18n/config';
import { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LanguageToggleProps {
    className?: string;
    variant?: 'full' | 'compact' | 'icon';
}

export default function LanguageToggle({ className = '', variant = 'compact' }: LanguageToggleProps) {
    const locale = useLocale() as Locale;
    const router = useRouter();
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLocaleChange = (newLocale: Locale) => {
        // Navigate using the router which handles the locale prefix
        router.push(pathname, { locale: newLocale });
        router.refresh();
        setIsOpen(false);
    };

    const otherLocale = locales.find(l => l !== locale) as Locale;

    // Icon-only variant
    if (variant === 'icon') {
        return (
            <button
                onClick={() => handleLocaleChange(otherLocale)}
                className={`
          p-2 rounded-lg
          bg-muted/50 hover:bg-muted
          border border-border/50 hover:border-border
          text-foreground
          transition-all duration-200
          flex items-center justify-center
          ${className}
        `}
                aria-label={`Switch to ${localeShortNames[otherLocale]}`}
            >
                <Globe className="w-5 h-5" />
            </button>
        );
    }

    // Compact variant - simple toggle button
    if (variant === 'compact') {
        return (
            <button
                onClick={() => handleLocaleChange(otherLocale)}
                className={`
          px-3 py-2 rounded-lg
          bg-muted/50 hover:bg-muted
          border border-border/50 hover:border-border
          text-sm font-medium text-foreground
          transition-all duration-200
          flex items-center gap-2
          group
          ${className}
        `}
                aria-label={`Switch to ${localeShortNames[otherLocale]}`}
            >
                <Globe className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="font-semibold">{localeShortNames[locale]}</span>
            </button>
        );
    }

    // Full variant - dropdown with all options
    return (
        <div ref={dropdownRef} className={`relative ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
          px-4 py-2.5 rounded-xl
          bg-gradient-to-br from-muted/80 to-muted/40
          hover:from-muted hover:to-muted/60
          border border-border/50 hover:border-primary/30
          text-sm font-medium text-foreground
          transition-all duration-300
          flex items-center gap-2.5
          shadow-sm hover:shadow-md
          group
        `}
                aria-label="Select language"
                aria-expanded={isOpen}
            >
                <Globe className="w-4 h-4 text-primary transition-transform group-hover:rotate-12" />
                <span className="font-semibold">{localeShortNames[locale]}</span>
                <ChevronDown
                    className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="
              absolute top-full right-0 mt-2
              min-w-[160px]
              bg-card/95 backdrop-blur-xl
              border border-border/50
              rounded-xl
              shadow-xl shadow-black/10
              overflow-hidden
              z-50
            "
                    >
                        {locales.map((l) => (
                            <button
                                key={l}
                                onClick={() => handleLocaleChange(l)}
                                className={`
                  w-full px-4 py-3
                  flex items-center justify-between gap-3
                  text-sm font-medium
                  transition-all duration-200
                  ${l === locale
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-foreground hover:bg-muted/50'
                                    }
                `}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-xs px-2 py-0.5 rounded-md bg-muted/80">
                                        {localeShortNames[l]}
                                    </span>
                                    <span>{l === 'pt-BR' ? 'Português' : 'English'}</span>
                                </div>
                                {l === locale && (
                                    <Check className="w-4 h-4 text-primary" />
                                )}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
