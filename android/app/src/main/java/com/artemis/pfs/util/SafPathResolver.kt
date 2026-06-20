package com.artemis.pfs.util

import android.net.Uri
import android.os.Environment
import android.provider.DocumentsContract

/**
 * Resolves a SAF tree URI to a real filesystem path.
 * Returns null if the URI format is unrecognized (caller should fall back to SAF copy).
 */
fun resolveSafPath(treeUri: Uri): String? {
    val treeDocId = try {
        DocumentsContract.getTreeDocumentId(treeUri)
    } catch (_: IllegalArgumentException) {
        return null
    }
    return resolveTreeDocumentId(treeDocId, Environment.getExternalStorageDirectory().absolutePath)
}

/**
 * Converts a tree document ID (e.g., "primary:Documents/folder") to an absolute path.
 * Handles internal storage ("primary:") and SD card UUIDs ("XXXX-XXXX:").
 * @param basePath the base path for "primary" storage (injectable for testing).
 */
fun resolveTreeDocumentId(treeDocumentId: String, basePath: String): String? {
    if (treeDocumentId.isEmpty()) return null

    val colonIndex = treeDocumentId.indexOf(':')
    if (colonIndex < 0) return null

    val storageType = treeDocumentId.substring(0, colonIndex)
    val subPath = treeDocumentId.substring(colonIndex + 1)

    val resolvedBase = when (storageType) {
        "primary" -> basePath
        else -> "/storage/$storageType"
    }

    return if (subPath.isEmpty()) {
        resolvedBase
    } else {
        "$resolvedBase/$subPath"
    }
}
