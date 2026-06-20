package com.artemis.pfs.viewmodel

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.artemis.pfs.R
import com.artemis.pfs.model.PfsEntry
import com.artemis.pfs.native.PfsBridge
import com.artemis.pfs.util.isSafDirectoryEntry
import com.artemis.pfs.util.resolveSafPath
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

private const val TAG = "MainViewModel"

data class UiState(
    val screen: Screen = Screen.Home,
    val entries: List<PfsEntry> = emptyList(),
    val archiveName: String = "",
    val handle: Long = 0,
    val isLoading: Boolean = false,
    val error: String? = null,
    val success: String? = null,
    val inputDirUri: Uri? = null
)

enum class Screen { Home, Viewer, Create }

class MainViewModel : ViewModel() {
    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state

    override fun onCleared() {
        super.onCleared()
        val handle = _state.value.handle
        if (handle > 0) {
            try { PfsBridge.closeArchiveSafe(handle) } catch (_: Throwable) {}
        }
    }

    fun openArchive(context: Context, uri: Uri) {
        viewModelScope.launch {
            // Close any previously opened archive
            val prevHandle = _state.value.handle
            if (prevHandle > 0) {
                withContext(Dispatchers.IO) {
                    try { PfsBridge.closeArchiveSafe(prevHandle) } catch (_: Throwable) {}
                }
            }
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val cachedFile = withContext(Dispatchers.IO) {
                    copyUriToCache(context, uri, "archive.pfs")
                }
                Log.d(TAG, "Cached file: ${cachedFile.absolutePath}, size=${cachedFile.length()}")
                // Validate PFS magic bytes before calling native code
                withContext(Dispatchers.IO) {
                    validatePfsMagic(context, cachedFile)
                }
                val handle = withContext(Dispatchers.IO) {
                    PfsBridge.openArchiveSafe(cachedFile.absolutePath)
                }
                Log.d(TAG, "openArchive returned handle=$handle")
                val errRes = PfsBridge.getOpenErrorStringRes(handle)
                if (errRes != null) {
                    _state.value = _state.value.copy(isLoading = false, error = context.getString(errRes))
                    return@launch
                }
                val entries = withContext(Dispatchers.IO) {
                    PfsBridge.listEntriesParsed(handle)
                }
                Log.d(TAG, "Listed ${entries.size} entries")
                val name = uri.lastPathSegment ?: "archive.pfs"
                _state.value = _state.value.copy(
                    screen = Screen.Viewer,
                    entries = entries,
                    archiveName = name,
                    handle = handle,
                    isLoading = false
                )
            } catch (e: Throwable) {
                Log.e(TAG, "openArchive failed", e)
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = (e as? Exception)?.message ?: context.getString(R.string.failed_to_open_archive, e.javaClass.simpleName)
                )
            }
        }
    }

    /**
     * Validates that the file starts with a PFS magic signature ("pf6" or "pf8").
     * Throws [IllegalArgumentException] if the file is not a PFS archive.
     * This prevents native crashes when non-PFS files are passed to the C bridge.
     */
    private fun validatePfsMagic(context: Context, file: File) {
        if (file.length() < 3) {
            throw IllegalArgumentException(context.getString(R.string.file_too_small))
        }
        val magic = file.inputStream().use { input ->
            val buf = ByteArray(3)
            input.read(buf)
            String(buf)
        }
        if (magic != "pf6" && magic != "pf8") {
            throw IllegalArgumentException(context.getString(R.string.invalid_file_header))
        }
    }

    fun extractAll(context: Context, destUri: Uri) {
        val handle = _state.value.handle
        if (handle == 0L) return
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val destPath = withContext(Dispatchers.IO) {
                    val dir = File(context.cacheDir, "extract_dest")
                    dir.mkdirs()
                    dir.absolutePath
                }
                val code = withContext(Dispatchers.IO) {
                    PfsBridge.extractAllSafe(handle, destPath)
                }
                val errRes = PfsBridge.getErrorStringRes(code)
                if (errRes != null) {
                    _state.value = _state.value.copy(isLoading = false, error = context.getString(errRes))
                    return@launch
                }
                // Copy extracted files to destination
                withContext(Dispatchers.IO) {
                    val destRealPath = resolveSafPath(destUri)
                    if (destRealPath != null) {
                        Log.d(TAG, "Extracting via File API to: $destRealPath")
                        File(destPath).copyRecursively(File(destRealPath), overwrite = true)
                    } else {
                        Log.d(TAG, "Extracting via SAF fallback")
                        copyDirToSaf(context, File(destPath), destUri)
                    }
                }
                _state.value = _state.value.copy(
                    isLoading = false,
                    success = context.getString(R.string.extracted_files, _state.value.entries.size)
                )
            } catch (e: Throwable) {
                Log.e(TAG, "extractAll failed", e)
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = (e as? Exception)?.message ?: context.getString(R.string.extract_failed, e.javaClass.simpleName)
                )
            }
        }
    }

    fun createArchive(context: Context, srcUri: Uri, outputName: String, outputDirUri: Uri) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val cacheSrc = withContext(Dispatchers.IO) {
                    val srcPath = resolveSafPath(srcUri)
                    if (srcPath != null) {
                        Log.d(TAG, "Using File API for path: $srcPath")
                        copyFileTreeToCache(context, File(srcPath), "create_src")
                    } else {
                        Log.d(TAG, "Falling back to SAF copy")
                        copyTreeToCache(context, srcUri, "create_src")
                    }
                }
                val fileCount = cacheSrc.walkTopDown().count { it.isFile }
                Log.d(TAG, "Copied $fileCount files to cache: ${cacheSrc.absolutePath}")
                if (fileCount == 0) {
                    _state.value = _state.value.copy(
                        isLoading = false,
                        error = context.getString(R.string.empty_folder)
                    )
                    return@launch
                }
                val outFile = File(context.cacheDir, outputName)
                val code = withContext(Dispatchers.IO) {
                    PfsBridge.createArchiveSafe(cacheSrc.absolutePath, outFile.absolutePath)
                }
                Log.d(TAG, "createArchive returned code=$code")
                val errRes = PfsBridge.getErrorStringRes(code)
                if (errRes != null) {
                    _state.value = _state.value.copy(isLoading = false, error = context.getString(errRes))
                    return@launch
                }
                // Copy the created archive to the user-selected SAF output directory
                withContext(Dispatchers.IO) {
                    copyFileToSaf(context, outFile, outputDirUri, outputName)
                }
                _state.value = _state.value.copy(
                    isLoading = false,
                    success = context.getString(R.string.archive_created, outputName)
                )
            } catch (e: Throwable) {
                Log.e(TAG, "createArchive failed", e)
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = (e as? Exception)?.message ?: context.getString(R.string.create_failed, e.javaClass.simpleName)
                )
            }
        }
    }

    fun navigateTo(screen: Screen) {
        _state.value = _state.value.copy(screen = screen, error = null, success = null)
    }

    fun clearMessages() {
        _state.value = _state.value.copy(error = null, success = null)
    }

    private fun copyUriToCache(context: Context, uri: Uri, name: String): File {
        val file = File(context.cacheDir, name)
        val input = context.contentResolver.openInputStream(uri)
            ?: throw IllegalArgumentException(context.getString(R.string.cannot_open_file))
        input.use { src ->
            file.outputStream().use { output -> src.copyTo(output) }
        }
        return file
    }

    /**
     * Checks whether a SAF document is a directory by querying its children.
     * Used as a fallback when the MIME type is null.
     */
    private fun isSafDirectory(context: Context, treeUri: Uri, documentId: String): Boolean {
        val childrenUri = android.provider.DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, documentId)
        return context.contentResolver.query(
            childrenUri,
            arrayOf(android.provider.DocumentsContract.Document.COLUMN_DOCUMENT_ID),
            null, null, null
        )?.use { cursor -> cursor.moveToFirst() } ?: false
    }

    private fun copyFileTreeToCache(context: Context, srcDir: File, dirName: String): File {
        val dest = File(context.cacheDir, dirName)
        dest.deleteRecursively()
        dest.mkdirs()
        srcDir.copyRecursively(dest, overwrite = true) { file, exception ->
            Log.w(TAG, "Failed to copy: $file", exception)
            OnErrorAction.SKIP
        }
        return dest
    }

    private fun copyTreeToCache(context: Context, treeUri: Uri, dirName: String): File {
        val dir = File(context.cacheDir, dirName)
        dir.deleteRecursively()
        dir.mkdirs()
        copyTreeChildrenRecursive(context, treeUri, dir)
        return dir
    }

    private fun copyTreeChildrenRecursive(context: Context, treeUri: Uri, destDir: File) {
        val docId = android.provider.DocumentsContract.getTreeDocumentId(treeUri)
        val childrenUri = android.provider.DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, docId)
        context.contentResolver.query(childrenUri, null, null, null, null)?.use { cursor ->
            val nameIdx = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
            val idIdx = cursor.getColumnIndex(android.provider.DocumentsContract.Document.COLUMN_DOCUMENT_ID)
            val mimeTypeIdx = cursor.getColumnIndex(android.provider.DocumentsContract.Document.COLUMN_MIME_TYPE)
            while (cursor.moveToNext()) {
                val name = cursor.getString(nameIdx)
                val childId = cursor.getString(idIdx)
                val childUri = android.provider.DocumentsContract.buildDocumentUriUsingTree(treeUri, childId)
                val mimeType = if (mimeTypeIdx >= 0) cursor.getString(mimeTypeIdx) else null
                val isDir = isSafDirectoryEntry(mimeType) { isSafDirectory(context, treeUri, childId) }
                if (isDir) {
                    val subDir = File(destDir, name)
                    subDir.mkdirs()
                    copyTreeChildrenRecursive(context, childUri, subDir)
                } else {
                    val outFile = File(destDir, name)
                    try {
                        context.contentResolver.openInputStream(childUri)?.use { input ->
                            outFile.outputStream().use { output -> input.copyTo(output) }
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Failed to copy file: $name", e)
                    }
                }
            }
        }
    }

    private fun copyDirToSaf(context: Context, srcDir: File, destUri: Uri) {
        // Convert tree URI to document URI for SAF operations
        val rootDocId = android.provider.DocumentsContract.getTreeDocumentId(destUri)
        val rootDocUri = android.provider.DocumentsContract.buildDocumentUriUsingTree(destUri, rootDocId)

        srcDir.walkTopDown().filter { it.isFile }.forEach { file ->
            val relativePath = file.relativeTo(srcDir)
            val parentParts = relativePath.parentFile?.path
            // Navigate or create subdirectories in SAF destination
            var currentUri = rootDocUri
            if (parentParts != null && parentParts != ".") {
                for (segment in relativePath.parent!!.split(File.separator)) {
                    if (segment.isNotEmpty()) {
                        currentUri = ensureSafSubdirectory(context, currentUri, segment)
                    }
                }
            }
            val mimeType = "application/octet-stream"
            android.provider.DocumentsContract.createDocument(
                context.contentResolver, currentUri, mimeType, file.name
            )?.let { destDocUri ->
                context.contentResolver.openOutputStream(destDocUri)?.use { output ->
                    file.inputStream().use { input -> input.copyTo(output) }
                }
            }
        }
    }

    private fun ensureSafSubdirectory(context: Context, parentUri: Uri, name: String): Uri {
        // Get the document ID regardless of whether this is a tree URI or document URI
        val isTree = android.provider.DocumentsContract.isTreeUri(parentUri)
        val docId = if (isTree) {
            android.provider.DocumentsContract.getTreeDocumentId(parentUri)
        } else {
            android.provider.DocumentsContract.getDocumentId(parentUri)
        }
        val childrenUri = android.provider.DocumentsContract.buildChildDocumentsUriUsingTree(parentUri, docId)
        // Check if subdirectory already exists
        context.contentResolver.query(childrenUri, null, null, null, null)?.use { cursor ->
            val nameIdx = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
            val idIdx = cursor.getColumnIndex(android.provider.DocumentsContract.Document.COLUMN_DOCUMENT_ID)
            while (cursor.moveToNext()) {
                if (cursor.getString(nameIdx) == name) {
                    val childId = cursor.getString(idIdx)
                    return android.provider.DocumentsContract.buildDocumentUriUsingTree(parentUri, childId)
                }
            }
        }
        // Create the subdirectory
        return android.provider.DocumentsContract.createDocument(
            context.contentResolver, childrenUri, "vnd.android.document/directory", name
        ) ?: parentUri
    }

    private fun copyFileToSaf(context: Context, srcFile: File, destDirUri: Uri, fileName: String) {
        val safeName = fileName.substringAfterLast('/').substringAfterLast('\\')
        Log.d(TAG, "copyFileToSaf: src=${srcFile.absolutePath} (${srcFile.length()} bytes), dest=$destDirUri, name=$safeName")
        // Convert tree URI to document URI for createDocument
        val docId = android.provider.DocumentsContract.getTreeDocumentId(destDirUri)
        val parentDocUri = android.provider.DocumentsContract.buildDocumentUriUsingTree(destDirUri, docId)
        val mimeType = "application/octet-stream"
        val destDocUri = android.provider.DocumentsContract.createDocument(
            context.contentResolver, parentDocUri, mimeType, safeName
        )
        if (destDocUri == null) {
            Log.e(TAG, "copyFileToSaf: createDocument returned null for $safeName in $parentDocUri")
            throw IllegalStateException(context.getString(R.string.cannot_create_file))
        }
        context.contentResolver.openOutputStream(destDocUri)?.use { output ->
            srcFile.inputStream().use { input -> input.copyTo(output) }
        } ?: throw IllegalStateException(context.getString(R.string.cannot_write_file))
        Log.d(TAG, "copyFileToSaf: done")
    }
}
