<script lang="ts">
	import { config } from '$lib/docs.config';
	import { page } from '$app/stores';

	let currentLang = $derived($page.params.lang || config.defaultLocale);
	let locale = $derived(config.locales[currentLang] || config.locales[config.defaultLocale]);
</script>

<svelte:head>
	<title>{locale.title}</title>
</svelte:head>

<div class="relative isolate overflow-hidden bg-ios-bg">
	<div class="mx-auto max-w-7xl px-6 pt-10 pb-24 sm:pb-32 lg:px-8 lg:py-32">
		<div class="mx-auto max-w-2xl text-center">
			<div class="mt-24 flex justify-center sm:mt-32">
				<a href="https://github.com/nostalgia296/artemis/releases/tag/a-v1.0" class="inline-flex space-x-6">
					<span
						class="rounded-full bg-ios-blue/10 px-3 py-1 text-sm leading-6 font-semibold text-ios-blue ring-1 ring-ios-blue/20 ring-inset"
						>{locale.ui.whatsNew}</span
					>
					<span
						class="inline-flex items-center space-x-2 text-sm leading-6 font-medium text-ios-secondary"
					>
						<span>{locale.ui.justShipped}</span>
						<svg
							class="h-5 w-5 text-ios-gray"
							viewBox="0 0 20 20"
							fill="currentColor"
							aria-hidden="true"
						>
							<path
								fill-rule="evenodd"
								d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
								clip-rule="evenodd"
							/>
						</svg>
					</span>
				</a>
			</div>
			<h1 class="mt-10 text-4xl font-bold tracking-tight text-ios-label sm:text-6xl">
				{locale.title.split(' ')[0]}
				<span class="text-ios-blue">{locale.title.split(' ').slice(1).join(' ') || 'Docs'}</span>
			</h1>
			<p class="mt-6 text-lg leading-8 text-ios-secondary">
				{locale.description}
			</p>
			<div class="mt-10 flex items-center justify-center gap-x-6">
				<a
					href={currentLang === config.defaultLocale
						? '/docs/getting-started'
						: `/${currentLang}/docs/getting-started`}
					class="rounded-xl bg-ios-blue px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-ios-blue-press focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ios-blue active:scale-95"
					>{locale.ui.getStarted}</a
				>
				{#each config.socialLinks as link}
					{#if link.icon === 'github'}
						<a
							href={link.link}
							class="group flex items-center gap-2 text-sm leading-6 font-semibold text-ios-label transition-colors hover:text-ios-blue"
						>
							{locale.ui.viewOnGithub}
							<span aria-hidden="true" class="transition-transform group-hover:translate-x-1"
								>→</span
							>
						</a>
					{/if}
				{/each}
			</div>
		</div>
		<div class="relative -mx-6 mx-auto mt-16 w-full max-w-full sm:mx-auto sm:mt-24 lg:max-w-4xl">
			<div
				class="w-full overflow-hidden rounded-none border-y border-ios-separator bg-ios-card shadow-2xl sm:rounded-[2rem] sm:border"
			>
				<div
					class="relative flex h-12 items-center justify-center gap-2 border-b border-ios-separator bg-ios-fill/50 px-4"
				>
					<div class="absolute left-4 flex gap-2">
						<div class="h-3 w-3 rounded-full bg-ios-red"></div>
						<div class="h-3 w-3 rounded-full bg-ios-orange"></div>
						<div class="h-3 w-3 rounded-full bg-ios-green"></div>
					</div>
					<div class="rounded-md bg-ios-fill px-4 py-1 text-xs font-medium text-ios-secondary">
						terminal
					</div>
				</div>
				<div
					class="scrollbar-thin overflow-x-auto p-4 text-left font-mono text-xs whitespace-nowrap text-ios-label sm:p-8 sm:text-sm"
				>
					<span class="text-ios-gray"># Extract all pfs files</span><br />
					<span class="text-ios-green">$</span> <span class="text-ios-blue">pfs</span> extract *pfs*<br />
					<br />
					<span class="text-ios-gray"># Pack a directory into .pfs</span><br />
					<span class="text-ios-green">$</span> <span class="text-ios-blue">pfs</span> create inputdir/
				</div>
			</div>
		</div>
	</div>
</div>
