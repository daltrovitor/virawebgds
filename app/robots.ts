const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://(coloque-aqui)'

// Export metadata object for Next's metadata route loader.
export default function handler() {
	return {
		rules: [
			{
				userAgent: '*',
				allow: '/',
			},
		],
		sitemap: `${SITE_URL.replace(/\/$/, '')}/sitemap.xml`,
	}
}
