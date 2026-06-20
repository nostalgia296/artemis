package com.artemis.pfs

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.mutableStateOf
import com.artemis.pfs.ui.navigation.ArtemisNavGraph
import com.artemis.pfs.ui.theme.ArtemisTheme

class MainActivity : ComponentActivity() {

    private val showPermissionDialog = mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        checkStoragePermission()

        setContent {
            ArtemisTheme {
                if (showPermissionDialog.value) {
                    AlertDialog(
                        onDismissRequest = { showPermissionDialog.value = false },
                        title = { Text(getString(R.string.permission_rationale_title)) },
                        text = { Text(getString(R.string.permission_rationale_message)) },
                        confirmButton = {
                            Button(onClick = {
                                showPermissionDialog.value = false
                                val intent = Intent(
                                    Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                                    Uri.parse("package:$packageName")
                                )
                                startActivity(intent)
                            }) {
                                Text(getString(R.string.grant_permission))
                            }
                        }
                    )
                }
                ArtemisNavGraph()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        checkStoragePermission()
    }

    private fun checkStoragePermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (!Environment.isExternalStorageManager()) {
                showPermissionDialog.value = true
            }
        }
    }
}
