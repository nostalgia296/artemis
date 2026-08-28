package com.artemis.pfs.ui.navigation

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberTopAppBarState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.viewmodel.compose.viewModel
import com.artemis.pfs.R
import com.artemis.pfs.ui.components.AdaptiveLayoutProvider
import com.artemis.pfs.ui.components.StellarDialog
import com.artemis.pfs.ui.screens.ArchiveViewerScreen
import com.artemis.pfs.ui.screens.CreateArchiveScreen
import com.artemis.pfs.ui.screens.HomeScreen
import com.artemis.pfs.viewmodel.MainViewModel
import com.artemis.pfs.viewmodel.Screen

private const val TRANSITION_DURATION_MS = 300

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArtemisNavGraph(viewModel: MainViewModel = viewModel()) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current
    var showCancelDialog by remember { mutableStateOf(false) }

    val topAppBarState = rememberTopAppBarState()
    val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior(topAppBarState)

    fun requestBackToHome() {
        if (state.isLoading && (state.screen == Screen.Viewer || state.screen == Screen.Create)) {
            showCancelDialog = true
        } else {
            viewModel.navigateTo(Screen.Home, context)
        }
    }

    if (showCancelDialog) {
        StellarDialog(
            onDismissRequest = { showCancelDialog = false },
            title = stringResource(R.string.cancel_task_title),
            confirmText = stringResource(R.string.confirm_return),
            dismissText = stringResource(R.string.continue_task),
            onConfirm = {
                showCancelDialog = false
                viewModel.cancelActiveTask(context)
                viewModel.navigateTo(Screen.Home, context)
            },
            onDismiss = { showCancelDialog = false }
        ) {
            Text(
                text = stringResource(R.string.cancel_task_message),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }

    AdaptiveLayoutProvider {
        // Stellar 风格页面转场：300ms 淡入淡出
        AnimatedContent(
            targetState = state.screen,
            transitionSpec = {
                fadeIn(animationSpec = tween(TRANSITION_DURATION_MS)) togetherWith
                    fadeOut(animationSpec = tween(TRANSITION_DURATION_MS))
            },
            label = "screen_transition"
        ) { screen ->
            when (screen) {
                Screen.Home -> HomeScreen(
                    state = state,
                    scrollBehavior = scrollBehavior,
                    onOpenArchive = { uri -> viewModel.openArchive(context, uri) },
                    onCreateArchive = { viewModel.navigateTo(Screen.Create, context) }
                )
                Screen.Viewer -> {
                    BackHandler { requestBackToHome() }
                    ArchiveViewerScreen(
                        state = state,
                        onExtractAll = { uri -> viewModel.extractAll(context, uri) },
                        onBack = { requestBackToHome() },
                        onRetry = { viewModel.clearMessages() }
                    )
                }
                Screen.Create -> {
                    BackHandler { requestBackToHome() }
                    CreateArchiveScreen(
                        state = state,
                        onCreate = { uri, name, outUri ->
                            viewModel.createArchive(context, uri, name, outUri)
                        },
                        onBack = { requestBackToHome() }
                    )
                }
            }
        }
    }
}
