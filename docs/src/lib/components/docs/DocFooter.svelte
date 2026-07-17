<script lang="ts">
	let { prevLink, nextLink, locale } = $props();
</script>

<div class="mt-8 flex items-center justify-between border-t border-ios-separator pt-8">
	{#if prevLink}
		<a
			href={prevLink.link}
			class="group flex flex-col items-start gap-1 text-sm text-ios-secondary transition-colors hover:text-ios-blue"
		>
			<span class="flex items-center gap-1 text-xs text-ios-gray">
				<svg
					class="h-4 w-4 transition-transform group-hover:-translate-x-1"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 19l-7-7 7-7"
					/></svg
				>
				{locale.ui.previous}
			</span>
			<span class="font-medium text-ios-label group-hover:text-ios-blue">{prevLink.text}</span>
		</a>
	{:else}
		<div></div>
	{/if}

	{#if nextLink}
		<a
			href={nextLink.link}
			class="group flex flex-col items-end gap-1 text-sm text-ios-secondary transition-colors hover:text-ios-blue"
		>
			<span class="flex items-center gap-1 text-xs text-ios-gray">
				{locale.ui.next}
				<svg
					class="h-4 w-4 transition-transform group-hover:translate-x-1"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 5l7 7-7 7"
					/></svg
				>
			</span>
			<span class="font-medium text-ios-label group-hover:text-ios-blue">{nextLink.text}</span>
		</a>
	{:else}
		<div></div>
	{/if}
</div>
