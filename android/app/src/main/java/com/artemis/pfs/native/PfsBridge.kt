package com.artemis.pfs.native

import com.artemis.pfs.R
import com.artemis.pfs.model.PfsEntry
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

object PfsBridge {
    private var loadError: String? = null

    init {
        try {
            System.loadLibrary("artemis_jni")
        } catch (e: UnsatisfiedLinkError) {
            loadError = e.message
        }
    }

    private fun ensureLoaded() {
        loadError?.let { throw IllegalStateException("Native library not available: $it") }
    }

    // Returns handle (positive) on success, negative on error
    external fun openArchive(path: String): Long
    external fun listEntries(handle: Long): String
    external fun extractAll(handle: Long, destPath: String): Int
    external fun createArchive(inputDirPath: String, outputPath: String): Int
    external fun closeArchive(handle: Long)

    fun openArchiveSafe(path: String): Long {
        ensureLoaded()
        return openArchive(path)
    }

    fun listEntriesParsed(handle: Long): List<PfsEntry> {
        ensureLoaded()
        val json = listEntries(handle)
        val type = object : TypeToken<List<PfsEntry>>() {}.type
        return Gson().fromJson(json, type) ?: emptyList()
    }

    fun extractAllSafe(handle: Long, destPath: String): Int {
        ensureLoaded()
        return extractAll(handle, destPath)
    }

    fun createArchiveSafe(inputDirPath: String, outputPath: String): Int {
        ensureLoaded()
        return createArchive(inputDirPath, outputPath)
    }

    fun closeArchiveSafe(handle: Long) {
        ensureLoaded()
        closeArchive(handle)
    }

    fun getOpenErrorStringRes(handle: Long): Int? {
        if (handle > 0) return null
        return R.string.file_not_found
    }

    fun getErrorStringRes(code: Int): Int? {
        if (code == 0) return null
        return when (code) {
            -1 -> R.string.file_not_found
            -2 -> R.string.not_valid_pfs
            -3 -> R.string.read_write_failed
            else -> R.string.unexpected_error
        }
    }

}
