package com.artemis.pfs.util

/**
 * Determines whether a SAF document should be treated as a directory.
 *
 * @param mimeType the MIME type from the cursor (may be null)
 * @param isDirectory a fallback check for when mimeType is null
 */
fun isSafDirectoryEntry(
    mimeType: String?,
    isDirectory: () -> Boolean
): Boolean {
    return mimeType == "vnd.android.document/directory"
        || mimeType?.endsWith(".directory") == true
        || (mimeType == null && isDirectory())
}
