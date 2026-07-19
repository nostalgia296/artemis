<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	let { locale } = $props();

	let isMobileTocOpen = $state(false);
	let headings = $state<{ id: string; text: string; depth: number }[]>([]);
	let activeHeading = $state<string>('');
	let observer: IntersectionObserver | null = null;

	$effect(() => {
		if (typeof document !== 'undefined') {
			if (isMobileTocOpen) {
				document.body.style.overflow = 'hidden';
			} else {
				document.body.style.overflow = '';
			}
		}
	});

	afterNavigate(() => {
		if (observer) observer.disconnect();
		
		setTimeout(() => {
			const article = document.querySelector('article.prose-custom');
			if (!article) return;
			
			const els = article.querySelectorAll('h2, h3');
			headings = Array.from(els).map((el, index) => {
				let id = el.id;
				if (!id) {
					const textId = el.textContent?.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-\u4e00-\u9fa5]/g, '');
					id = textId || `heading-${index}`;
					el.id = id;
				}
				el.classList.add('scroll-mt-20');
				
				return {
					id,
					text: el.textContent || '',
					depth: Number(el.tagName.substring(1))
				};
			});

			observer = new IntersectionObserver(
				(entries) => {
					entries.forEach((entry) => {
						if (entry.isIntersecting) {
							activeHeading = entry.target.id;
						}
					});
				},
				{ rootMargin: '0px 0px -60% 0px' }
			);

			els.forEach((el) => observer?.observe(el));
		}, 0);
	});
</script>

<!-- Desktop Right Sidebar (Table of Contents) -->
<div class="hidden xl:block xl:w-64 xl:shrink-0 xl:pl-8">
	<div class="sticky top-24 max-h-[calc(100vh-8rem)] scrollbar-thin overflow-y-auto pb-8">
		<h3 class="mb-4 px-2 text-xs font-semibold tracking-wider text-ios-secondary uppercase">
			{locale.ui.onThisPage}
		</h3>
		{#if headings.length > 0}
			<ul class="flex flex-col gap-2.5 border-l border-ios-separator pl-4">
				{#each headings as heading}
					<li>
						<a
							href="#{heading.id}"
							class="block text-sm transition-colors hover:text-ios-label {activeHeading === heading.id
								? 'text-ios-blue font-medium'
								: 'text-ios-secondary'} {heading.depth === 3 ? 'ml-3' : ''}"
						>
							{heading.text}
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<div class="text-sm text-ios-secondary px-2">-</div>
		{/if}
	</div>
</div>

<!-- Mobile TOC Floating Button -->
{#if headings.length > 0}
	<button
		class="fixed bottom-8 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-ios-blue text-white shadow-xl transition-transform hover:scale-105 active:scale-95 xl:hidden"
		onclick={() => (isMobileTocOpen = true)}
		aria-label="Table of Contents"
	>
		<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" />
		</svg>
	</button>
{/if}

<!-- Mobile TOC Overlay -->
{#if isMobileTocOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm xl:hidden"
		onclick={() => (isMobileTocOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (isMobileTocOpen = false)}
		role="button"
		tabindex="0"
		aria-label="Close TOC"
		transition:fade={{ duration: 200 }}
	></div>

	<div
		class="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] flex flex-col rounded-t-3xl bg-ios-bg p-6 shadow-2xl xl:hidden"
		transition:fly={{ y: '100%', duration: 300, easing: cubicOut }}
	>
		<div class="mb-6 flex shrink-0 items-center justify-between">
			<h3 class="text-lg font-semibold text-ios-label">{locale.ui.onThisPage}</h3>
			<button
				class="rounded-full bg-ios-fill p-2 text-ios-secondary transition-colors hover:bg-ios-fill2 hover:text-ios-label"
				onclick={() => (isMobileTocOpen = false)}
				aria-label="Close"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
		
		<div class="scrollbar-thin overflow-y-auto pb-6">
			<ul class="flex flex-col gap-4 border-l border-ios-separator pl-4">
				{#each headings as heading}
					<li>
						<a
							href="#{heading.id}"
							onclick={() => (isMobileTocOpen = false)}
							class="block text-base transition-colors hover:text-ios-label {activeHeading === heading.id
								? 'text-ios-blue font-medium'
								: 'text-ios-secondary'} {heading.depth === 3 ? 'ml-4' : ''}"
						>
							{heading.text}
						</a>
					</li>
				{/each}
			</ul>
		</div>
	</div>
{/if}
