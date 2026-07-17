import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const lang = params.lang || 'en';
	const slug = params.slug || 'getting-started';

	try {
		// Vite's dynamic import must have a predictable extension
		const post = await import(`../../../../../src/content/${lang}/${slug}.svx`);

		return {
			content: post.default,
			meta: post.metadata
		};
	} catch {
		throw error(404, `Could not find ${lang}/${slug}`);
	}
};
