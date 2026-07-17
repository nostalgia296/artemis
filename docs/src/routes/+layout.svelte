<script lang="ts">
	import './layout.css';
	import { config } from '$lib/docs.config';
	import { page } from '$app/stores';

	let { children } = $props();

	let currentLang = $derived($page.params.lang || config.defaultLocale);
	let locale = $derived(config.locales[currentLang] || config.locales[config.defaultLocale]);

	function toggleTheme() {
		if (typeof window !== 'undefined') {
			const isDark = document.documentElement.classList.toggle('dark');
			localStorage.theme = isDark ? 'dark' : 'light';
		}
	}

	function switchLanguage(newLang: string) {
		const currentPath = $page.url.pathname;
		if (newLang === config.defaultLocale) {
			return currentPath.replace(`/${currentLang}`, '') || '/';
		} else {
			return `/${newLang}${currentPath.replace(`/${currentLang}`, '')}`;
		}
	}
</script>

<div class="flex min-h-screen flex-col selection:bg-ios-blue selection:text-white">
	<header class="ios-blur sticky top-0 z-50 w-full border-b border-ios-separator">
		<div class="flex h-14 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
			<div class="flex items-center gap-6">
				<a
					href={currentLang === config.defaultLocale ? '/' : `/${currentLang}`}
					class="flex items-center gap-2 text-lg font-semibold tracking-tight text-ios-label"
				>
					<svg class="h-6 w-6 text-ios-blue" viewBox="0 0 24 24" fill="currentColor"
						><path
							d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
							stroke="currentColor"
							stroke-width="2"
							stroke-linejoin="round"
							fill="none"
						/></svg
					>
					{locale.title}
				</a>
				<nav class="hidden gap-6 text-sm font-medium text-ios-secondary md:flex">
					{#each locale.nav as item}
						<a href={item.link} class="transition-colors hover:text-ios-label">{item.text}</a>
					{/each}
				</nav>
			</div>

			<div class="flex items-center gap-4">
				<div class="relative hidden md:block">
					<div
						class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ios-gray"
					>
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/></svg
						>
					</div>
					<input
						type="text"
						class="block w-64 rounded-xl border-0 bg-ios-fill py-1.5 pr-3 pl-9 text-ios-label transition-colors outline-none placeholder:text-ios-gray focus:bg-ios-fill2 focus:ring-2 focus:ring-ios-blue sm:text-sm sm:leading-6"
						placeholder={locale.ui.searchPlaceholder}
					/>
				</div>

				<!-- Language Switcher -->
				<div class="ml-2 flex items-center gap-2 border-l border-ios-separator pl-4">
					{#each Object.keys(config.locales) as langKey}
						<a
							href={switchLanguage(langKey)}
							class="rounded-md px-2 py-1 text-xs font-medium transition-colors {currentLang ===
							langKey
								? 'bg-ios-fill text-ios-label'
								: 'text-ios-secondary hover:text-ios-label'}"
						>
							{langKey.toUpperCase()}
						</a>
					{/each}
				</div>

				<button
					onclick={toggleTheme}
					class="rounded-full p-1.5 text-ios-secondary transition-colors hover:bg-ios-fill"
					aria-label="Toggle Dark Mode"
				>
					<svg
						class="hidden h-5 w-5 dark:block"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
						/></svg
					>
					<svg
						class="block h-5 w-5 dark:hidden"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
						/></svg
					>
				</button>
				{#each config.socialLinks as link}
					{#if link.icon === 'github'}
						<a
							href={link.link}
							target="_blank"
							rel="noopener noreferrer"
							class="text-ios-secondary transition-colors hover:text-ios-label"
						>
							<span class="sr-only">GitHub</span>
							<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"
								><path
									fill-rule="evenodd"
									d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
									clip-rule="evenodd"
								/></svg
							>
						</a>
					{/if}
				{/each}
			</div>
		</div>
	</header>

	<main class="flex flex-grow flex-col bg-ios-bg">
		{@render children()}
	</main>
</div>
