/**
 * Sound and Haptic Feedback Utility
 * Provides subtle, chess.com-style feedback for user interactions
 */

export type FeedbackType = 'tap' | 'success' | 'error' | 'move' | 'toggle'

// Audio context and buffers for web audio API (for better performance and control)
let audioContext: AudioContext | null = null
const audioBuffers: Map<FeedbackType, AudioBuffer> = new Map()

// Initialize audio context on first user interaction
const initAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return audioContext
}

/**
 * Generate subtle sound effects programmatically using Web Audio API
 * This avoids needing external audio files while providing pleasant sounds
 */
const generateSoundBuffer = (type: FeedbackType): AudioBuffer => {
  const ctx = initAudioContext()
  const sampleRate = ctx.sampleRate

  let duration = 0.1 // Default duration in seconds
  let frequencies: number[] = []

  switch (type) {
    case 'tap':
      // Very subtle click - single high frequency
      duration = 0.05
      frequencies = [800]
      break
    case 'success':
      // Pleasant upward chime - major chord
      duration = 0.15
      frequencies = [523.25, 659.25, 783.99] // C5, E5, G5
      break
    case 'error':
      // Gentle downward tone - minor chord, lower
      duration = 0.12
      frequencies = [329.63, 293.66] // E4, D4
      break
    case 'move':
      // Soft whoosh/transition
      duration = 0.08
      frequencies = [440, 880] // A4, A5
      break
    case 'toggle':
      // Quick click
      duration = 0.06
      frequencies = [600]
      break
  }

  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate)
  const data = buffer.getChannelData(0)

  for (let i = 0; i < buffer.length; i++) {
    const t = i / sampleRate
    let sample = 0

    // Generate sound by combining frequencies
    frequencies.forEach((freq, idx) => {
      const amplitude = 0.1 / frequencies.length // Very quiet
      sample += amplitude * Math.sin(2 * Math.PI * freq * t)
    })

    // Apply envelope (attack-decay) for smooth sound
    const attackTime = 0.01
    const envelope = t < attackTime
      ? t / attackTime // Attack (fade in)
      : 1 - (t - attackTime) / (duration - attackTime) // Decay (fade out)

    data[i] = sample * envelope
  }

  return buffer
}

/**
 * Play a sound effect
 */
const playSound = (type: FeedbackType) => {
  try {
    const ctx = initAudioContext()

    // Generate buffer if not cached
    if (!audioBuffers.has(type)) {
      audioBuffers.set(type, generateSoundBuffer(type))
    }

    const buffer = audioBuffers.get(type)
    if (!buffer) return

    const source = ctx.createBufferSource()
    source.buffer = buffer

    // Add gain node for volume control
    const gainNode = ctx.createGain()
    gainNode.gain.value = 0.3 // Keep it subtle

    source.connect(gainNode)
    gainNode.connect(ctx.destination)
    source.start(0)
  } catch (err) {
    // Silently fail - don't break the app if audio doesn't work
    console.debug('Sound playback failed:', err)
  }
}

/**
 * Trigger haptic feedback using the Vibration API
 */
const playHaptic = (type: FeedbackType) => {
  if (!navigator.vibrate) return

  try {
    switch (type) {
      case 'tap':
      case 'toggle':
        // Very light tap
        navigator.vibrate(5)
        break
      case 'success':
        // Double tap pattern
        navigator.vibrate([10, 30, 15])
        break
      case 'error':
        // Single medium tap
        navigator.vibrate(20)
        break
      case 'move':
        // Light tap
        navigator.vibrate(8)
        break
    }
  } catch (err) {
    // Silently fail - don't break the app if vibration doesn't work
    console.debug('Haptic feedback failed:', err)
  }
}

/**
 * Check if sound is enabled
 */
export const isSoundEnabled = (): boolean => {
  const saved = localStorage.getItem('soundEnabled')
  return saved !== 'false' // Default to true
}

/**
 * Check if haptic feedback is enabled
 */
export const isHapticEnabled = (): boolean => {
  const saved = localStorage.getItem('hapticEnabled')
  return saved !== 'false' // Default to true
}

/**
 * Main feedback function - plays sound and/or haptic based on settings
 */
export const playFeedback = (type: FeedbackType) => {
  if (isSoundEnabled()) {
    playSound(type)
  }
  if (isHapticEnabled()) {
    playHaptic(type)
  }
}

/**
 * Set sound enabled state
 */
export const setSoundEnabled = (enabled: boolean) => {
  localStorage.setItem('soundEnabled', String(enabled))
}

/**
 * Set haptic enabled state
 */
export const setHapticEnabled = (enabled: boolean) => {
  localStorage.setItem('hapticEnabled', String(enabled))
}
