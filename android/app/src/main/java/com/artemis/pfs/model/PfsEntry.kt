package com.artemis.pfs.model

data class PfsEntry(
    val name: String,
    val offset: Long,
    val size: Long
)
