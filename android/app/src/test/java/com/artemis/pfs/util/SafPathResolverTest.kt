package com.artemis.pfs.util

import org.junit.Assert.*
import org.junit.Test

class SafPathResolverTest {

    // Use a fixed base path for deterministic tests
    private val basePath = "/storage/emulated/0"

    @Test
    fun `resolves primary storage root`() {
        assertEquals(basePath, resolveTreeDocumentId("primary:", basePath))
    }

    @Test
    fun `resolves primary storage with path`() {
        assertEquals("$basePath/Documents/folder",
            resolveTreeDocumentId("primary:Documents/folder", basePath))
    }

    @Test
    fun `resolves primary storage with nested path`() {
        assertEquals("$basePath/DCIM/Camera/2024",
            resolveTreeDocumentId("primary:DCIM/Camera/2024", basePath))
    }

    @Test
    fun `resolves SD card UUID`() {
        assertEquals("/storage/ABCD-1234/Photos",
            resolveTreeDocumentId("ABCD-1234:Photos", basePath))
    }

    @Test
    fun `resolves SD card UUID root`() {
        assertEquals("/storage/ABCD-1234",
            resolveTreeDocumentId("ABCD-1234:", basePath))
    }

    @Test
    fun `returns null for empty string`() {
        assertNull(resolveTreeDocumentId("", basePath))
    }

    @Test
    fun `returns null for string without colon`() {
        assertNull(resolveTreeDocumentId("nocolon", basePath))
    }
}
