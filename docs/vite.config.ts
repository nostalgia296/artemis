import { mdsvex } from 'mdsvex';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import remarkExpressiveCode from 'remark-expressive-code';

function mdsvexExpressiveCodeHack() {
	return (tree: any) => {
		function walk(node: any) {
			if (node.type === 'html' && node.value.includes('expressive-code')) {
				node.value = `{@html ${JSON.stringify(node.value)}}`;
			}
			if (node.children) {
				node.children.forEach(walk);
			}
		}
		walk(tree);
	};
}

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
				warningFilter: (warning) => warning.code !== 'script_context_deprecated'
			},
			adapter: adapter(),
			preprocess: [
				mdsvex({
					extensions: ['.svx', '.md'],
					remarkPlugins: [
						[
							remarkExpressiveCode,
							{
								themes: ['github-light', 'github-dark'],
								themeCssSelector: (theme: any) =>
									theme.name === 'github-light' ? ':root' : '.dark',
								useDarkModeMediaQuery: false,
								styleOverrides: {
									codeBackground: 'var(--color-ios-card)',
									borderColor: 'var(--color-ios-separator)',
									borderRadius: '0.5rem',
									borderWidth: '1px',
									uiFontFamily: 'var(--font-sans)',
									frames: {
										frameBoxShadowCssValue: 'none',
										editorTabBarBackground: 'var(--color-ios-bg)',
										editorActiveTabBackground: 'var(--color-ios-card)',
										editorActiveTabBorderColor: 'var(--color-ios-separator)',
										editorTabBarBorderBottomColor: 'var(--color-ios-separator)',
										terminalBackground: 'var(--color-ios-card)',
										terminalTitlebarBackground: 'var(--color-ios-bg)',
										terminalTitlebarBorderBottomColor: 'var(--color-ios-separator)',
										inlineButtonBackground: 'var(--color-ios-fill2)',
										inlineButtonBackgroundIdleOpacity: '0',
										inlineButtonBackgroundHoverOrFocusOpacity: '0.8',
										inlineButtonBackgroundActiveOpacity: '1',
										inlineButtonBorder: 'transparent',
										inlineButtonForeground: 'var(--color-ios-secondary)',
										tooltipSuccessBackground: 'var(--color-ios-green)',
										tooltipSuccessForeground: '#ffffff'
									}
								}
							}
						],
						mdsvexExpressiveCodeHack
					]
				})
			],
			extensions: ['.svelte', '.svx', '.md']
		})
	]
});
