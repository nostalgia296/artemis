<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>{data.meta?.title || 'Documentation'}</title>
</svelte:head>

<!-- We render the compiled markdown component dynamically -->
<svelte:component this={data.content} />
