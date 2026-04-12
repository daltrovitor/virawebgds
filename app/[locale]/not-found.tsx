'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function NotFound() {
    const t = useTranslations('errors');

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="text-center">
                <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
                <p className="text-xl text-muted-foreground mb-8">{t('notFound')}</p>
                <Link
                    href="/"
                    className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                    Voltar ao início
                </Link>
            </div>
        </div>
    );
}
