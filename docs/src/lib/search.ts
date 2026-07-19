import { config } from '$lib/docs.config';

export interface SearchDoc {
	lang: string;
	slug: string;
	href: string;
	title: string;
	description: string;
	body: string;
}

const modules = import.meta.glob('../content/**/*.{svx,md}', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
	if (!match) return { meta: {}, body: raw };

	const meta: Record<string, string> = {};
	for (const line of match[1].split('\n')) {
		const m = line.match(/^([\w-]+):\s*(.*)$/);
		if (!m) continue;
		meta[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
	}

	return { meta, body: match[2] };
}

function stripMarkdown(md: string): string {
	return md
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`[^`]+`/g, ' ')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/^#{1,6}\s+/gm, '')
		.replace(/[*_~>`|-]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function hrefFor(lang: string, slug: string): string {
	const path = `/docs/${slug}`;
	return lang === config.defaultLocale ? path : `/${lang}${path}`;
}

let cachedIndex: SearchDoc[] | null = null;

export function getSearchIndex(): SearchDoc[] {
	if (cachedIndex) return cachedIndex;

	const docs: SearchDoc[] = [];

	for (const [path, raw] of Object.entries(modules)) {
		const match = path.match(/\/content\/([^/]+)\/(.+)\.(?:svx|md)$/);
		if (!match) continue;

		const lang = match[1];
		const slug = match[2];
		const { meta, body } = parseFrontmatter(raw);

		docs.push({
			lang,
			slug,
			href: hrefFor(lang, slug),
			title: meta.title || slug,
			description: meta.description || '',
			body: stripMarkdown(body)
		});
	}

	cachedIndex = docs;
	return docs;
}

export function searchDocs(query: string, lang: string, limit = 8): SearchDoc[] {
	const q = query.trim().toLowerCase();
	if (!q) return [];

	const terms = q.split(/\s+/).filter(Boolean);
	if (terms.length === 0) return [];

	return getSearchIndex()
		.filter((doc) => doc.lang === lang)
		.map((doc) => {
			const title = doc.title.toLowerCase();
			const description = doc.description.toLowerCase();
			const body = doc.body.toLowerCase();
			let score = 0;

			for (const term of terms) {
				if (title === term) score += 20;
				else if (title.startsWith(term)) score += 12;
				else if (title.includes(term)) score += 8;

				if (description.includes(term)) score += 3;
				if (body.includes(term)) score += 1;
			}

			return { doc, score };
		})
		.filter((entry) => entry.score > 0)
		.sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title))
		.slice(0, limit)
		.map((entry) => entry.doc);
}
