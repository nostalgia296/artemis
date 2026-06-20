package com.artemis.pfs.util

import org.junit.Assert.*
import org.junit.Test

class DirectoryDetectorTest {

    @Test
    fun `detects standard directory MIME type`() {
        assertTrue(isSafDirectoryEntry("vnd.android.document/directory") { false })
    }

    @Test
    fun `detects custom MIME type ending with dot-directory`() {
        assertTrue(isSafDirectoryEntry("application/x-foo.directory") { false })
    }

    @Test
    fun `rejects file MIME type`() {
        assertFalse(isSafDirectoryEntry("image/png") { false })
        assertFalse(isSafDirectoryEntry("text/plain") { false })
        assertFalse(isSafDirectoryEntry("application/octet-stream") { false })
    }

    @Test
    fun `falls back to isDirectory check when mimeType is null`() {
        // This is the bug: when mimeType is null for a directory,
        // the code should check via isDirectory() instead of treating it as a file.
        assertTrue(
            "Should detect directory when mimeType is null and isDirectory returns true",
            isSafDirectoryEntry(null) { true }
        )
    }

    @Test
    fun `treats null mimeType as file when isDirectory returns false`() {
        assertFalse(
            "Should treat as file when mimeType is null and isDirectory returns false",
            isSafDirectoryEntry(null) { false }
        )
    }
}
