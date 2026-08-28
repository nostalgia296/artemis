package com.artemis.pfs.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.artemis.pfs.ui.theme.AppShape
import com.artemis.pfs.ui.theme.AppSpacing

@Composable
fun IconContainer(
    icon: ImageVector,
    modifier: Modifier = Modifier,
    containerColor: Color = MaterialTheme.colorScheme.primaryContainer,
    iconColor: Color = MaterialTheme.colorScheme.primary,
    shape: Shape = AppShape.shapes.iconSmall,
    containerSize: Dp = AppSpacing.iconContainerSize,
    iconSize: Dp = AppSpacing.iconSize
) {
    Box(
        modifier = modifier
            .size(containerSize)
            .clip(shape)
            .background(containerColor),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = iconColor,
            modifier = Modifier.size(iconSize)
        )
    }
}

/**
 * 状态型大图标盒（48dp），底色为前景色 15% 透明度 —— 用于状态卡头部。
 */
@Composable
fun StatusIconContainer(
    icon: ImageVector,
    contentColor: Color,
    modifier: Modifier = Modifier,
    containerSize: Dp = 48.dp,
    iconSize: Dp = 24.dp
) {
    Box(
        modifier = modifier
            .size(containerSize)
            .clip(AppShape.shapes.iconSmall)
            .background(contentColor.copy(alpha = 0.15f)),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = contentColor,
            modifier = Modifier.size(iconSize)
        )
    }
}
