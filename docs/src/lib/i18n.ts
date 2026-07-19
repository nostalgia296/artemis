import { config } from '$lib/docs.config';

/** Locale keys excluding the default (which has no URL prefix). */
function nonDefaultLocales(): string[] {
	return Object.keys(config.locales).filter((locale) => locale !== config.defaultLocale);
}

/**
 * Strip a leading locale prefix from a pathname.
 * `/zh/docs/cli` → `/docs/cli`, `/en/...` is left alone if en is default.
 */
export function stripLocalePrefix(pathname: string): string {
	for (const locale of nonDefaultLocales()) {
		if (pathname === `/${locale}`) return '/';
		if (pathname.startsWith(`/${locale}/`)) {
			return pathname.slice(locale.length + 1) || '/';
		}
	}
	return pathname || '/';
}

/**
 * Build a pathname for `targetLocale`, preserving the rest of the path
 * (and optionally search/hash via the caller).
 */
export function localizePath(pathname: string, targetLocale: string): string {
	const bare = stripLocalePrefix(pathname);

	if (targetLocale === config.defaultLocale) {
		return bare || '/';
	}

	if (!bare || bare === '/') {
		return `/${targetLocale}`;
	}

	return `/${targetLocale}${bare.startsWith('/') ? bare : `/${bare}`}`;
}
