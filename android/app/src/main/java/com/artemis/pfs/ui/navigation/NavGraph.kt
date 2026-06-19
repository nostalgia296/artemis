package com.artemis.pfs.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import com.artemis.pfs.ui.screens.ArchiveViewerScreen
import com.artemis.pfs.ui.screens.CreateArchiveScreen
import com.artemis.pfs.ui.screens.HomeScreen
import com.artemis.pfs.viewmodel.MainViewModel
import com.artemis.pfs.viewmodel.Screen

@Composable
fun ArtemisNavGraph(viewModel: MainViewModel = viewModel()) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current

    when (state.screen) {
        Screen.Home -> HomeScreen(
            state = state,
            onOpenArchive = { uri -> viewModel.openArchive(context, uri) },
            onCreateArchive = { viewModel.navigateTo(Screen.Create) }
        )
        Screen.Viewer -> ArchiveViewerScreen(
            state = state,
            onExtractAll = { uri -> viewModel.extractAll(context, uri) },
            onBack = { viewModel.navigateTo(Screen.Home) },
            onRetry = { viewModel.clearMessages() }
        )
        Screen.Create -> CreateArchiveScreen(
            state = state,
            onCreate = { uri, name, outUri -> viewModel.createArchive(context, uri, name, outUri) },
            onBack = { viewModel.navigateTo(Screen.Home) }
        )
    }
}
