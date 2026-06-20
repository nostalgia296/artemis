package com.artemis.pfs.util

import org.junit.Assert.*
import org.junit.Test

class PathSanitizerTest {

    @Test
    fun `strips path traversal to leaf filename`() {
        assertEquals("passwd", sanitizeFileName("../../../etc/passwd"))
    }

    @Test
    fun `strips Windows path traversal to leaf filename`() {
        assertEquals("System32", sanitizeFileName("..\\..\\..\\Windows\\System32"))
    }

    @Test
    fun `strips absolute Unix path to leaf filename`() {
        assertEquals("passwd", sanitizeFileName("/etc/passwd"))
    }

    @Test
    fun `strips absolute Windows path to leaf filename`() {
        assertEquals("System32", sanitizeFileName("C:\\Windows\\System32"))
    }

    @Test
    fun `accepts normal filename`() {
        assertEquals("document.txt", sanitizeFileName("document.txt"))
    }

    @Test
    fun `accepts filename with spaces`() {
        assertEquals("my document.txt", sanitizeFileName("my document.txt"))
    }

    @Test
    fun `strips leading and trailing whitespace`() {
        assertEquals("document.txt", sanitizeFileName("  document.txt  "))
    }

    @Test
    fun `rejects empty filename`() {
        assertNull(sanitizeFileName(""))
        assertNull(sanitizeFileName("   "))
    }

    @Test
    fun `rejects path separator only`() {
        assertNull(sanitizeFileName("/"))
        assertNull(sanitizeFileName("\\"))
        assertNull(sanitizeFileName("//"))
        assertNull(sanitizeFileName("///"))
    }

    @Test
    fun `rejects trailing separator`() {
        assertNull(sanitizeFileName("foo/"))
        assertNull(sanitizeFileName("foo\\"))
        assertNull(sanitizeFileName("/etc/"))
    }
}
