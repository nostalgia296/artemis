package com.artemis.pfs.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CreateNewFolder
import androidx.compose.material.icons.filled.DriveFolderUpload
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.artemis.pfs.R
import com.artemis.pfs.ui.components.IconContainer
import com.artemis.pfs.ui.components.StaggeredEntrance
import com.artemis.pfs.ui.theme.AppShape
import com.artemis.pfs.ui.theme.AppSpacing
import com.artemis.pfs.viewmodel.UiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateArchiveScreen(
    state: UiState,
    onCreate: (Uri, String, Uri) -> Unit,
    onBack: () -> Unit
) {
    var outputName by remember { mutableStateOf("root.pfs") }
    var selectedDir by remember { mutableStateOf<Uri?>(null) }
    var outputDir by remember { mutableStateOf<Uri?>(null) }

    val dirLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocumentTree()
    ) { uri -> selectedDir = uri }

    val outputDirLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocumentTree()
    ) { uri -> outputDir = uri }

    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.error) {
        state.error?.let { snackbarHostState.showSnackbar(it) }
    }
    LaunchedEffect(state.success) {
        state.success?.let { snackbarHostState.showSnackbar(it) }
    }

    val canCreate = selectedDir != null && outputDir != null && !state.isLoading

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.create_archive)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.back))
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
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
            verticalArrangement = Arrangement.spacedBy(AppSpacing.itemSpacing)
        ) {
            item {
                StaggeredEntrance(index = 0) {
                    DirectoryPickerCard(
                        icon = Icons.Default.FolderOpen,
                        label = stringResource(R.string.input_directory),
                        value = selectedDir?.lastPathSegment
                            ?: stringResource(R.string.tap_to_select),
                        onSelect = { dirLauncher.launch(null) }
                    )
                }
            }

            item {
                StaggeredEntrance(index = 1) {
                    OutlinedTextField(
                        value = outputName,
                        onValueChange = { outputName = it },
                        label = { Text(stringResource(R.string.output_filename)) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = AppShape.shapes.inputField,
                        textStyle = MaterialTheme.typography.bodyLarge.copy(
                            fontFamily = FontFamily.Monospace
                        )
                    )
                }
            }

            item {
                StaggeredEntrance(index = 2) {
                    DirectoryPickerCard(
                        icon = Icons.Default.DriveFolderUpload,
                        label = stringResource(R.string.output_directory),
                        value = outputDir?.lastPathSegment
                            ?: stringResource(R.string.tap_to_select),
                        onSelect = { outputDirLauncher.launch(null) }
                    )
                }
            }

            item {
                StaggeredEntrance(index = 3) {
                    Button(
                        onClick = {
                            selectedDir?.let { src ->
                                outputDir?.let { out -> onCreate(src, outputName, out) }
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp),
                        enabled = canCreate,
                        shape = AppShape.shapes.buttonMedium
                    ) {
                        AnimatedVisibility(
                            visible = state.isLoading,
                            enter = fadeIn() + expandVertically(),
                            exit = fadeOut() + shrinkVertically()
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(18.dp),
                                    color = MaterialTheme.colorScheme.onPrimary,
                                    strokeWidth = 2.dp
                                )
                                if (state.progress > 0) {
                                    Spacer(modifier = Modifier.width(AppSpacing.dialogButtonSpacing))
                                    Text(
                                        text = "${state.progress}%",
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }
                        }
                        AnimatedVisibility(
                            visible = !state.isLoading,
                            enter = fadeIn(),
                            exit = fadeOut()
                        ) {
                            Text(
                                text = stringResource(R.string.create_archive),
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * 目录选择卡：cardMedium(16) + surfaceContainer 底 + 图标容器 + 标题/值。
 */
@Composable
private fun DirectoryPickerCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    value: String,
    onSelect: () -> Unit
) {
    Card(
        onClick = onSelect,
        modifier = Modifier.fillMaxWidth(),
        shape = AppShape.shapes.cardMedium,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainer
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(AppSpacing.cardPadding),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconContainer(icon = icon)
            Spacer(modifier = Modifier.width(AppSpacing.iconTextSpacing))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(AppSpacing.titleSubtitleSpacing))
                Text(
                    text = value,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1
                )
            }
            Spacer(modifier = Modifier.width(AppSpacing.dialogButtonSpacing))
            IconContainer(
                icon = Icons.Default.CreateNewFolder,
                containerColor = MaterialTheme.colorScheme.secondaryContainer,
                iconColor = MaterialTheme.colorScheme.secondary
            )
        }
    }
}
