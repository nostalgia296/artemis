package com.artemis.pfs.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import kotlinx.coroutines.delay

/**
 * Stellar 风格的错峰入场动效：
 * 每个元素延迟 index * 100ms 后以 fadeIn(300) + slideInVertically(300, FastOutSlowInEasing){ -24 } 进入。
 *
 * 用于列表/网格首屏呈现，复刻自 Stellar 启动器时间线步骤入场。
 */
@Composable
fun StaggeredEntrance(
    index: Int,
    modifier: Modifier = Modifier,
    staggerDelayMs: Long = 100L,
    content: @Composable () -> Unit
) {
    var visible by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        delay(index * staggerDelayMs)
        visible = true
    }

    AnimatedVisibility(
        visible = visible,
        modifier = modifier,
        enter = fadeIn(animationSpec = tween(300)) + slideInVertically(
            animationSpec = tween(300, easing = FastOutSlowInEasing),
            initialOffsetY = { -24 }
        )
    ) {
        content()
    }
}
