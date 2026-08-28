package com.artemis.pfs.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Unarchive
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.artemis.pfs.R
import com.artemis.pfs.model.PfsEntry
import com.artemis.pfs.ui.components.StaggeredEntrance
import com.artemis.pfs.ui.components.StatusIconContainer
import com.artemis.pfs.ui.theme.AppShape
import com.artemis.pfs.ui.theme.AppSpacing
import com.artemis.pfs.viewmodel.UiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArchiveViewerScreen(
    state: UiState,
    onExtractAll: (Uri) -> Unit,
    onBack: () -> Unit,
    onRetry: () -> Unit = {}
) {
    val extractLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocumentTree()
    ) { uri -> uri?.let { onExtractAll(it) } }

    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.error) {
        state.error?.let { snackbarHostState.showSnackbar(it) }
    }
    LaunchedEffect(state.success) {
        state.success?.let { snackbarHostState.showSnackbar(it) }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(state.archiveName) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.back))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors()
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { if (!state.isLoading) extractLauncher.launch(null) },
                shape = AppShape.shapes.fab,
                containerColor = MaterialTheme.colorScheme.primaryContainer,
                icon = {
                    Icon(
                        Icons.Default.Unarchive,
                        contentDescription = null,
                        modifier = Modifier.size(AppSpacing.iconSize)
                    )
                },
                text = { Text(stringResource(R.string.extract_all)) }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(
                top = AppSpacing.topBarContentSpacing,
                bottom = AppSpacing.screenBottomPadding,
                start = AppSpacing.screenHorizontalPadding,
                end = AppSpacing.screenHorizontalPadding
            ),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.cardSpacing)
        ) {
            item {
                StaggeredEntrance(index = 0) {
                    ArchiveStatusCard(state = state)
                }
            }

            if (!state.isLoading && state.entries.isNotEmpty()) {
                item {
                    Text(
                        text = stringResource(R.string.file_count, state.entries.size),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(vertical = AppSpacing.dialogButtonSpacing)
                    )
                }
            }

            if (!state.isLoading) {
                // 错峰入场：列表项按 index*40ms 依次滑入，最多错峰 10 项避免过长等待
                itemsIndexed(state.entries) { index, entry ->
                    StaggeredEntrance(index = (index + 1).coerceAtMost(10), staggerDelayMs = 40L) {
                        EntryRow(entry)
                    }
                }
            }
        }
    }
}

/**
 * 归档状态卡：弹簧伸缩（animateContentSize + DampingRatioMediumBouncy / StiffnessLow），
 * 加载中时展开进度区 —— 复刻 Stellar ServerStatusCard。
 */
@Composable
private fun ArchiveStatusCard(state: UiState) {
    val isPositive = !state.isLoading && state.error == null
    val backgroundColor = if (isPositive) {
        MaterialTheme.colorScheme.primaryContainer
    } else {
        MaterialTheme.colorScheme.errorContainer
    }
    val contentColor = if (isPositive) {
        MaterialTheme.colorScheme.onPrimaryContainer
    } else {
        MaterialTheme.colorScheme.onErrorContainer
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .animateContentSize(
                animationSpec = spring(
                    dampingRatio = Spring.DampingRatioMediumBouncy,
                    stiffness = Spring.StiffnessLow
                )
            ),
        shape = AppShape.shapes.cardLarge,
        colors = CardDefaults.cardColors(containerColor = backgroundColor)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                StatusIconContainer(
                    icon = if (isPositive) Icons.Default.CheckCircle else Icons.Default.Error,
                    contentColor = contentColor
                )
                Spacer(modifier = Modifier.width(AppSpacing.cardPadding))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = state.archiveName,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = contentColor,
                        maxLines = 1
                    )
                    Spacer(modifier = Modifier.height(AppSpacing.titleSubtitleSpacing))
                    Text(
                        text = if (state.isLoading) {
                            stringResource(R.string.extracting)
                        } else {
                            stringResource(R.string.file_count, state.entries.size)
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = contentColor.copy(alpha = 0.7f)
                    )
                }
            }

            AnimatedVisibility(
                visible = state.isLoading,
                enter = expandVertically() + fadeIn(),
                exit = shrinkVertically() + fadeOut()
            ) {
                Column {
                    Spacer(modifier = Modifier.height(AppSpacing.cardSpacing))
                    HorizontalDivider(color = contentColor.copy(alpha = 0.2f))
                    Spacer(modifier = Modifier.height(AppSpacing.cardSpacing))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            color = contentColor,
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(AppSpacing.dialogButtonSpacing))
                        Text(
                            text = if (state.progress > 0) {
                                "${state.progress}%"
                            } else {
                                stringResource(R.string.extracting)
                            },
                            style = MaterialTheme.typography.bodySmall,
                            fontFamily = FontFamily.Monospace,
                            color = contentColor.copy(alpha = 0.7f)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun EntryRow(entry: PfsEntry) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = AppShape.shapes.cardMedium,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainer
        )
    ) {
        Row(
            modifier = Modifier.padding(horizontal = AppSpacing.cardPadding, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(AppSpacing.iconContainerSize)
                    .clip(AppShape.shapes.iconSmall)
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Description,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(AppSpacing.iconSize)
                )
            }
            Spacer(modifier = Modifier.width(AppSpacing.iconTextSpacing))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = entry.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1
                )
            }
            Spacer(modifier = Modifier.width(AppSpacing.dialogButtonSpacing))
            Text(
                text = formatSize(entry.size),
                style = MaterialTheme.typography.bodySmall,
                fontFamily = FontFamily.Monospace,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

private fun formatSize(bytes: Long): String {
    return when {
        bytes < 1024 -> "$bytes B"
        bytes < 1024 * 1024 -> "${bytes / 1024} KB"
        else -> "${"%.1f".format(bytes / (1024.0 * 1024.0))} MB"
    }
}
