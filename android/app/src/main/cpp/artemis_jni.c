#include <jni.h>
#include <stdlib.h>
#include <string.h>

// Go exported functions (from bridge.go)
// PFS_Open returns handle (positive) or negative on error:
//   -1 = invalid path, -2 = parse error, -3 = I/O error, -4 = unknown
extern long PFS_Open(char* path);
extern char* PFS_ListEntries(long handle);
extern int PFS_Extract(long handle, char* dest);
extern int PFS_Create(char* srcDir, char* outPath);
extern void PFS_Close(long handle);
extern void PFS_CancelCurrentTask();
extern int PFS_GetProgress();

JNIEXPORT jlong JNICALL
Java_com_artemis_pfs_native_PfsBridge_openArchive(
    JNIEnv *env, jobject thiz, jstring path) {
    const char *cPath = (*env)->GetStringUTFChars(env, path, NULL);
    long handle = PFS_Open((char*)cPath);
    (*env)->ReleaseStringUTFChars(env, path, cPath);
    return (jlong)handle;
}

JNIEXPORT jstring JNICALL
Java_com_artemis_pfs_native_PfsBridge_listEntries(
    JNIEnv *env, jobject thiz, jlong handle) {
    char *json = PFS_ListEntries((long)handle);
    jstring result = (*env)->NewStringUTF(env, json);
    free(json);
    return result;
}

JNIEXPORT jint JNICALL
Java_com_artemis_pfs_native_PfsBridge_extractAll(
    JNIEnv *env, jobject thiz, jlong handle, jstring dest) {
    const char *cDest = (*env)->GetStringUTFChars(env, dest, NULL);
    int code = PFS_Extract((long)handle, (char*)cDest);
    (*env)->ReleaseStringUTFChars(env, dest, cDest);
    return (jint)code;
}

JNIEXPORT jint JNICALL
Java_com_artemis_pfs_native_PfsBridge_createArchive(
    JNIEnv *env, jobject thiz, jstring srcDir, jstring outPath) {
    const char *cSrc = (*env)->GetStringUTFChars(env, srcDir, NULL);
    const char *cOut = (*env)->GetStringUTFChars(env, outPath, NULL);
    int code = PFS_Create((char*)cSrc, (char*)cOut);
    (*env)->ReleaseStringUTFChars(env, srcDir, cSrc);
    (*env)->ReleaseStringUTFChars(env, outPath, cOut);
    return (jint)code;
}

JNIEXPORT void JNICALL
Java_com_artemis_pfs_native_PfsBridge_closeArchive(
    JNIEnv *env, jobject thiz, jlong handle) {
    PFS_Close((long)handle);
}

JNIEXPORT void JNICALL
Java_com_artemis_pfs_native_PfsBridge_cancelCurrentTask(
    JNIEnv *env, jobject thiz) {
    PFS_CancelCurrentTask();
}

JNIEXPORT jint JNICALL
Java_com_artemis_pfs_native_PfsBridge_getProgress(
    JNIEnv *env, jobject thiz) {
    return (jint)PFS_GetProgress();
}
