package com.artemis.pfs.util

import android.net.Uri
import android.provider.DocumentsContract

/**
 * Builds a document URI suitable for createDocument operations.
 * This produces a /document/ URI, not a /children/ query URI.
 */
fun buildDocumentUriForCreate(treeUri: Uri, documentId: String): Uri {
    return DocumentsContract.buildDocumentUriUsingTree(treeUri, documentId)
}

/**
 * Builds a children URI for querying child documents.
 */
fun buildChildrenUriForQuery(treeUri: Uri, documentId: String): Uri {
    return DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, documentId)
}
