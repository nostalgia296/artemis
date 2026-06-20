package com.artemis.pfs.util

/**
 * Sanitizes a file name to prevent path traversal attacks.
 * Returns null if the name is empty or invalid.
 */
fun sanitizeFileName(name: String): String? {
    val trimmed = name.trim()
    if (trimmed.isEmpty()) return null

    // Take only the last component after any path separator
    val lastComponent = trimmed
        .substringAfterLast('/')
        .substringAfterLast('\\')

    // Reject empty, current-dir, or parent-dir patterns
    if (lastComponent.isEmpty() || lastComponent == "." || lastComponent == "..") return null

    return lastComponent
}
