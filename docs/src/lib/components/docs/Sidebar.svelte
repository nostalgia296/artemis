<script lang="ts">
	import { afterNavigate } from '$app/navigation';

	let { locale, pathname, isMobileOpen = $bindable(false) } = $props();

	afterNavigate(() => {
		isMobileOpen = false;
	});
</script>

<!-- Mobile Sidebar Toggle -->
<div class="mb-4 lg:hidden">
	<button
		onclick={() => (isMobileOpen = !isMobileOpen)}
		class="flex w-full items-center justify-between rounded-xl border border-ios-separator bg-ios-card px-4 py-3 text-sm font-medium text-ios-label shadow-sm transition-colors hover:bg-ios-fill"
	>
		<span class="flex items-center gap-2">
			<svg class="h-5 w-5 text-ios-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 6h16M4 12h16M4 18h16"
				/>
			</svg>
			{locale.ui.menu || 'Menu'}
		</span>
		<svg
			class="h-5 w-5 text-ios-secondary transition-transform duration-200 {isMobileOpen
				? 'rotate-180'
				: ''}"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>
</div>

<!-- Sidebar -->
<aside
	class="{isMobileOpen
		? 'block'
		: 'hidden'} mb-8 lg:mb-0 lg:block lg:w-64 lg:shrink-0 lg:pr-8"
>
	<nav class="scrollbar-thin max-h-[calc(100vh-8rem)] overflow-y-auto lg:sticky lg:top-24">
		<ul class="flex flex-col gap-6">
			{#each locale.sidebar as section}
				<li>
					<h2 class="mb-2 px-2 text-sm font-semibold text-ios-label">{section.text}</h2>
					{#if section.items}
						<ul class="flex flex-col gap-1">
							{#each section.items as link}
								<li>
									<a
										href={link.link}
										class="block rounded-lg px-2.5 py-1.5 text-sm transition-colors {pathname ===
										link.link
											? 'bg-ios-blue/10 font-medium text-ios-blue dark:bg-ios-blue/20'
											: 'text-ios-secondary hover:bg-ios-fill hover:text-ios-label'}"
									>
										{link.text}
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ul>
	</nav>
</aside>
