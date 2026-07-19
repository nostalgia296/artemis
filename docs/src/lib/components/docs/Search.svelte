<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { searchDocs, type SearchDoc } from '$lib/search';
	import type { LocaleConfig } from '$lib/docs.config';

	let { locale, lang }: { locale: LocaleConfig; lang: string } = $props();

	let query = $state('');
	let open = $state(false);
	let mobileOpen = $state(false);
	let activeIndex = $state(0);
	let inputEl = $state<HTMLInputElement | null>(null);
	let mobileInputEl = $state<HTMLInputElement | null>(null);
	let rootEl = $state<HTMLDivElement | null>(null);

	let results = $derived(searchDocs(query, lang));

	$effect(() => {
		// Reset highlight when the result set changes.
		void results;
		activeIndex = 0;
	});

	afterNavigate(() => {
		closeAll();
	});

	function closeAll() {
		open = false;
		mobileOpen = false;
		query = '';
		activeIndex = 0;
	}

	function openMobile() {
		mobileOpen = true;
		queueMicrotask(() => mobileInputEl?.focus());
	}

	function onInput() {
		open = query.trim().length > 0;
	}

	async function goToResult(doc: SearchDoc) {
		closeAll();
		await goto(doc.href);
	}

	function onKeydown(event: KeyboardEvent, docs: SearchDoc[]) {
		if (event.key === 'Escape') {
			event.preventDefault();
			closeAll();
			inputEl?.blur();
			mobileInputEl?.blur();
			return;
		}

		if (!docs.length) return;

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			activeIndex = (activeIndex + 1) % docs.length;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeIndex = (activeIndex - 1 + docs.length) % docs.length;
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const target = docs[activeIndex];
			if (target) void goToResult(target);
		}
	}

	function onDocumentPointerDown(event: PointerEvent) {
		if (!rootEl) return;
		if (!rootEl.contains(event.target as Node)) {
			open = false;
			if (!mobileOpen) query = '';
		}
	}

	function onGlobalKeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			if (window.matchMedia('(min-width: 768px)').matches) {
				inputEl?.focus();
				open = query.trim().length > 0;
			} else {
				openMobile();
			}
		}
	}
</script>

<svelte:window onpointerdown={onDocumentPointerDown} onkeydown={onGlobalKeydown} />

<div class="relative" bind:this={rootEl}>
	<!-- Desktop search -->
	<div class="relative hidden md:block">
		<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ios-gray">
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
				/>
			</svg>
		</div>
		<input
			bind:this={inputEl}
			bind:value={query}
			type="search"
			autocomplete="off"
			autocorrect="off"
			spellcheck="false"
			role="combobox"
			aria-expanded={open && results.length > 0}
			aria-controls="docs-search-results"
			aria-autocomplete="list"
			class="block w-64 rounded-xl border-0 bg-ios-fill py-1.5 pr-12 pl-9 text-ios-label transition-colors outline-none placeholder:text-ios-gray focus:bg-ios-fill2 focus:ring-2 focus:ring-ios-blue sm:text-sm sm:leading-6"
			placeholder={locale.ui.searchPlaceholder}
			oninput={onInput}
			onfocus={onInput}
			onkeydown={(e) => onKeydown(e, results)}
		/>
		<kbd
			class="pointer-events-none absolute inset-y-0 right-2 my-auto hidden h-5 items-center rounded border border-ios-separator bg-ios-card px-1.5 font-sans text-[10px] font-medium text-ios-gray sm:flex"
		>
			⌘K
		</kbd>

		{#if open && query.trim()}
			<div
				id="docs-search-results"
				class="absolute top-full right-0 left-0 z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-ios-separator bg-ios-card py-2 shadow-xl"
				role="listbox"
			>
				{#if results.length > 0}
					{#each results as doc, i}
						<a
							href={doc.href}
							role="option"
							aria-selected={i === activeIndex}
							class="block px-3 py-2.5 transition-colors {i === activeIndex
								? 'bg-ios-blue/10 text-ios-blue'
								: 'text-ios-label hover:bg-ios-fill'}"
							onmouseenter={() => (activeIndex = i)}
							onclick={() => closeAll()}
						>
							<div class="text-sm font-medium">{doc.title}</div>
							{#if doc.excerpt}
								<div class="mt-0.5 line-clamp-2 text-xs text-ios-secondary">{doc.excerpt}</div>
							{:else if doc.description}
								<div class="mt-0.5 line-clamp-1 text-xs text-ios-secondary">{doc.description}</div>
							{/if}
						</a>
					{/each}
				{:else}
					<div class="px-3 py-3 text-sm text-ios-secondary">{locale.ui.searchNoResults}</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Mobile search trigger -->
	<button
		type="button"
		class="rounded-full p-1.5 text-ios-secondary transition-colors hover:bg-ios-fill md:hidden"
		aria-label={locale.ui.search}
		onclick={openMobile}
	>
		<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
			/>
		</svg>
	</button>

	<!-- Mobile full-screen search -->
	{#if mobileOpen}
		<div class="fixed inset-0 z-[60] flex flex-col bg-ios-bg md:hidden">
			<div class="flex items-center gap-2 border-b border-ios-separator px-3 py-3">
				<div class="relative min-w-0 flex-1">
					<div
						class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ios-gray"
					>
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/>
						</svg>
					</div>
					<input
						bind:this={mobileInputEl}
						bind:value={query}
						type="search"
						autocomplete="off"
						autocorrect="off"
						spellcheck="false"
						class="block w-full rounded-xl border-0 bg-ios-fill py-2.5 pr-3 pl-9 text-ios-label outline-none placeholder:text-ios-gray focus:bg-ios-fill2 focus:ring-2 focus:ring-ios-blue sm:text-sm"
						placeholder={locale.ui.searchPlaceholder}
						onkeydown={(e) => onKeydown(e, results)}
					/>
				</div>
				<button
					type="button"
					class="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-ios-blue"
					onclick={closeAll}
				>
					{locale.ui.searchCancel}
				</button>
			</div>

			<div class="flex-1 overflow-y-auto p-2">
				{#if query.trim()}
					{#if results.length > 0}
						{#each results as doc, i}
							<a
								href={doc.href}
								class="block rounded-xl px-3 py-3 transition-colors {i === activeIndex
									? 'bg-ios-blue/10 text-ios-blue'
									: 'text-ios-label hover:bg-ios-fill'}"
								onclick={() => closeAll()}
							>
								<div class="text-sm font-medium">{doc.title}</div>
								{#if doc.excerpt}
									<div class="mt-0.5 line-clamp-2 text-xs text-ios-secondary">{doc.excerpt}</div>
								{:else if doc.description}
									<div class="mt-0.5 text-xs text-ios-secondary">{doc.description}</div>
								{/if}
							</a>
						{/each}
					{:else}
						<div class="px-3 py-6 text-center text-sm text-ios-secondary">
							{locale.ui.searchNoResults}
						</div>
					{/if}
				{/if}
			</div>
		</div>
	{/if}
</div>
