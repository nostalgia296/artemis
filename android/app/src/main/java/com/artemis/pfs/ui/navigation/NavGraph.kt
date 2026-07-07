package com.artemis.pfs.ui.navigation

import androidx.activity.compose.BackHandler
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.artemis.pfs.ui.screens.ArchiveViewerScreen
import com.artemis.pfs.ui.screens.CreateArchiveScreen
import com.artemis.pfs.ui.screens.HomeScreen
import com.artemis.pfs.viewmodel.MainViewModel
import com.artemis.pfs.viewmodel.Screen

@Composable
fun ArtemisNavGraph(viewModel: MainViewModel = viewModel()) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current
    var showCancelDialog by remember { mutableStateOf(false) }

    fun requestBackToHome() {
        if (state.isLoading && (state.screen == Screen.Viewer || state.screen == Screen.Create)) {
            showCancelDialog = true
        } else {
            viewModel.navigateTo(Screen.Home, context)
        }
    }

    if (showCancelDialog) {
        AlertDialog(
            onDismissRequest = { showCancelDialog = false },
            title = { Text(stringResource(R.string.cancel_task_title)) },
            text = { Text(stringResource(R.string.cancel_task_message)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        showCancelDialog = false
                        viewModel.cancelActiveTask(context)
                        viewModel.navigateTo(Screen.Home, context)
                    }
                ) {
                    Text(stringResource(R.string.confirm_return))
                }
            },
            dismissButton = {
                TextButton(onClick = { showCancelDialog = false }) {
                    Text(stringResource(R.string.continue_task))
                }
            }
        )
    }

    when (state.screen) {
        Screen.Home -> HomeScreen(
            state = state,
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
                onCreate = { uri, name, outUri -> viewModel.createArchive(context, uri, name, outUri) },
                onBack = { requestBackToHome() }
            )
        }
    }
}
