<script lang="ts">
	let { data } = $props();
	let Content = $derived(data.content);
</script>

<svelte:head>
	<title>{data.meta?.title || 'Documentation'}</title>
</svelte:head>

<!-- We render the compiled markdown component dynamically -->
<Content />
