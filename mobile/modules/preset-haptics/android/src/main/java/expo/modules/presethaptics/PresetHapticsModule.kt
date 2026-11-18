package expo.modules.presethaptics

import android.content.Context
import android.media.AudioAttributes
import android.os.Build
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PresetHapticsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PresetHaptics")

    Function("vibrate") { pattern: List<Int> ->
      val context = appContext.reactContext ?: return@Function
      val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        context.getSystemService(VibratorManager::class.java)?.defaultVibrator
      } else {
        context.getSystemService(Vibrator::class.java)
      }
      if (vibrator == null || !vibrator.hasVibrator() || pattern.isEmpty()) return@Function

      val timings = pattern.map(Int::toLong).toLongArray()
      playTouchFeedback(vibrator, timings)
    }
  }

  @Suppress("DEPRECATION")
  private fun playTouchFeedback(vibrator: Vibrator, timings: LongArray) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      val attributes = VibrationAttributes.createForUsage(VibrationAttributes.USAGE_TOUCH)
      vibrator.vibrate(VibrationEffect.createWaveform(timings, -1), attributes)
      return
    }

    val attributes = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      vibrator.vibrate(VibrationEffect.createWaveform(timings, -1), attributes)
    } else {
      vibrator.vibrate(timings, -1, attributes)
    }
  }
}
