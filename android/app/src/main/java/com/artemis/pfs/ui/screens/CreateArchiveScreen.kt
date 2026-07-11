package com.artemis.pfs.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.artemis.pfs.R
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Card(
                onClick = { dirLauncher.launch(null) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(Modifier.padding(16.dp)) {
                    Text(stringResource(R.string.input_directory), style = MaterialTheme.typography.labelMedium)
                    Spacer(Modifier.height(8.dp))
                    Text(
                        selectedDir?.lastPathSegment ?: stringResource(R.string.tap_to_select),
                        style = MaterialTheme.typography.bodyLarge
                    )
                }
            }

            OutlinedTextField(
                value = outputName,
                onValueChange = { outputName = it },
                label = { Text(stringResource(R.string.output_filename)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            Card(
                onClick = { outputDirLauncher.launch(null) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(Modifier.padding(16.dp)) {
                    Text(stringResource(R.string.output_directory), style = MaterialTheme.typography.labelMedium)
                    Spacer(Modifier.height(8.dp))
                    Text(
                        outputDir?.lastPathSegment ?: stringResource(R.string.tap_to_select),
                        style = MaterialTheme.typography.bodyLarge
                    )
                }
            }

            Button(
                onClick = {
                    selectedDir?.let { src ->
                        outputDir?.let { out -> onCreate(src, outputName, out) }
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = selectedDir != null && outputDir != null && !state.isLoading
            ) {
                if (state.isLoading) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                        if (state.progress > 0) {
                            Spacer(Modifier.width(8.dp))
                            Text("${state.progress}%")
                        }
                    }
                } else {
                    Text(stringResource(R.string.create_archive))
                }
            }
        }
    }
}
