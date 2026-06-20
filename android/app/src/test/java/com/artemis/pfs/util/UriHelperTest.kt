package com.artemis.pfs.util

/**
 * URI helper functions require Android instrumentation tests (androidTest)
 * because DocumentsContract methods need the Android framework.
 *
 * TODO: Add instrumentation tests in androidTest/ to verify:
 *  - buildDocumentUriForCreate produces /document/ URIs (not /children/)
 *  - buildChildrenUriForQuery produces /children/ URIs
 *
 * Run with: ./gradlew connectedAndroidTest
 */
