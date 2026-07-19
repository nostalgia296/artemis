export type Theme = 'light' | 'dark';

export function getPreferredTheme(): Theme {
	if (typeof window === 'undefined') return 'light';

	const stored = localStorage.getItem('theme');
	if (stored === 'dark' || stored === 'light') return stored;

	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme) {
	if (typeof document === 'undefined') return;

	const root = document.documentElement;
	root.classList.toggle('dark', theme === 'dark');
	root.classList.toggle('light', theme === 'light');
	localStorage.setItem('theme', theme);
}

export function toggleTheme(): Theme {
	const next: Theme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
	applyTheme(next);
	return next;
}
