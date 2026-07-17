import { config } from '$lib/docs.config';
import type { ParamMatcher } from '@sveltejs/kit';

export const match: ParamMatcher = (param) => {
	return param in config.locales;
};
