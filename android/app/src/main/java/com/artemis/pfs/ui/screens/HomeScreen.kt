package com.artemis.pfs.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.CreateNewFolder
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LargeTopAppBar
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarScrollBehavior
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.artemis.pfs.R
import com.artemis.pfs.ui.components.IconContainer
import com.artemis.pfs.ui.components.LocalScreenConfig
import com.artemis.pfs.ui.components.StaggeredEntrance
import com.artemis.pfs.ui.theme.AppShape
import com.artemis.pfs.ui.theme.AppSpacing
import com.artemis.pfs.viewmodel.UiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    state: UiState,
    scrollBehavior: TopAppBarScrollBehavior,
    onOpenArchive: (Uri) -> Unit,
    onCreateArchive: () -> Unit
) {
    val openLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri -> uri?.let { onOpenArchive(it) } }

    val snackbarHostState = remember { SnackbarHostState() }
    val screenConfig = LocalScreenConfig.current
    val gridColumns = screenConfig.gridColumns

    LaunchedEffect(state.error) {
        state.error?.let { snackbarHostState.showSnackbar(it) }
    }
    LaunchedEffect(state.success) {
        state.success?.let { snackbarHostState.showSnackbar(it) }
    }

    Scaffold(
        modifier = Modifier
            .fillMaxSize()
            .nestedScroll(scrollBehavior.nestedScrollConnection),
        topBar = {
            LargeTopAppBar(
                title = {
                    Text(
                        text = stringResource(R.string.app_name),
                        fontWeight = FontWeight.Bold
                    )
                },
                scrollBehavior = scrollBehavior
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { paddingValues ->
        LazyVerticalGrid(
            columns = GridCells.Fixed(gridColumns),
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                top = paddingValues.calculateTopPadding() + AppSpacing.topBarContentSpacing,
                bottom = AppSpacing.screenBottomPadding,
                start = AppSpacing.screenHorizontalPadding,
                end = AppSpacing.screenHorizontalPadding
            ),
            horizontalArrangement = Arrangement.spacedBy(AppSpacing.itemSpacing),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.itemSpacing)
        ) {
            item(span = { GridItemSpan(gridColumns) }) {
                StaggeredEntrance(index = 0) {
                    HeroCard()
                }
            }

            item {
                StaggeredEntrance(index = 1) {
                    ActionCard(
                        icon = Icons.Default.FolderOpen,
                        title = stringResource(R.string.open_archive),
                        subtitle = stringResource(R.string.browse_and_extract),
                        buttonText = stringResource(R.string.open_archive),
                        enabled = !state.isLoading,
                        onClick = { openLauncher.launch(arrayOf("*/*")) }
                    )
                }
            }

            item {
                StaggeredEntrance(index = 2) {
                    ActionCard(
                        icon = Icons.Default.CreateNewFolder,
                        title = stringResource(R.string.create_archive),
                        subtitle = stringResource(R.string.pack_files),
                        buttonText = stringResource(R.string.create),
                        enabled = !state.isLoading,
                        onClick = onCreateArchive
                    )
                }
            }
        }
    }
}

/**
 * 首屏整行大卡：满铺 primaryContainer 强调色，复刻 Stellar ServerStatusCard 的强调型卡片。
 */
@Composable
private fun HeroCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = AppShape.shapes.cardLarge,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Column(
            modifier = Modifier.padding(20.dp)
        ) {
            IconContainer(
                icon = Icons.Default.Archive,
                containerColor = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.15f),
                iconColor = MaterialTheme.colorScheme.onPrimaryContainer,
                containerSize = 48.dp,
                iconSize = 24.dp
            )
            Spacer(modifier = Modifier.height(AppSpacing.cardPadding))
            Text(
                text = stringResource(R.string.pfs_archive_manager),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )
            Spacer(modifier = Modifier.height(AppSpacing.titleSubtitleSpacing))
            Text(
                text = stringResource(R.string.app_name),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
            )
        }
    }
}

/**
 * 启动类卡片：cardLarge(24) + surfaceContainer 底 + 48dp 图标盒 + 右侧按钮。
 * 复刻 Stellar StartRootCard / StartWirelessAdbCard 形态。
 */
@Composable
private fun ActionCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String,
    buttonText: String,
    enabled: Boolean,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = AppShape.shapes.cardLarge,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainer
        )
    ) {
        Column(
            modifier = Modifier.padding(20.dp)
        ) {
            IconContainer(
                icon = icon,
                containerSize = 48.dp,
                iconSize = 24.dp
            )
            Spacer(modifier = Modifier.height(AppSpacing.cardPadding))
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                maxLines = 1
            )
            Spacer(modifier = Modifier.height(AppSpacing.titleSubtitleSpacing))
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(AppSpacing.cardPadding))
            Button(
                onClick = onClick,
                enabled = enabled,
                shape = AppShape.shapes.buttonMedium,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(text = buttonText)
                Spacer(modifier = Modifier.width(AppSpacing.dialogButtonSpacing))
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}
