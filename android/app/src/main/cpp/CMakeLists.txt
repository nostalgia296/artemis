cmake_minimum_required(VERSION 3.22.1)
project("artemis-jni")

add_library(artemis_go SHARED IMPORTED)
set_target_properties(artemis_go PROPERTIES
    IMPORTED_LOCATION ${CMAKE_SOURCE_DIR}/../jniLibs/${ANDROID_ABI}/libartemis-jni.so
    IMPORTED_NO_SONAME TRUE
)

add_library(artemis_jni SHARED artemis_jni.c)
target_link_libraries(artemis_jni artemis_go log)
