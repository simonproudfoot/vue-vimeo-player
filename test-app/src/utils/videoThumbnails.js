/**
 * Utility functions for generating thumbnails from video URLs
 */

/**
 * Captures a frame from a video element at a specific timestamp and returns it as a data URL
 * @param {HTMLVideoElement} videoElement - The video element to capture from
 * @param {number} timeSeconds - The timestamp in seconds to capture
 * @param {number} width - Optional width for the thumbnail (default: 320)
 * @param {number} height - Optional height for the thumbnail (default: 180)
 * @returns {Promise<string>} - A data URL of the captured frame
 */
export async function captureVideoFrameFromElement(videoElement, timeSeconds, width = 320, height = 180) {
  return new Promise((resolve, reject) => {
    if (!videoElement || !(videoElement instanceof HTMLVideoElement)) {
      reject(new Error('Invalid video element provided'))
      return
    }

    // Get the video URL from the element
    const videoUrl = videoElement.src || videoElement.currentSrc
    
    // Create a new video element for thumbnail generation
    // For local files, we don't need crossOrigin
    const thumbVideo = document.createElement('video')
    // Only set crossOrigin if it's not a local file (check if URL is absolute and different origin)
    if (videoUrl && (videoUrl.startsWith('http://') || videoUrl.startsWith('https://'))) {
      thumbVideo.crossOrigin = 'anonymous'
    }
    thumbVideo.preload = 'auto'
    thumbVideo.muted = true
    thumbVideo.playsInline = true
    
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    
    // Ensure we don't seek beyond video duration
    // Add a small offset for 0.0s to avoid 416 Range Not Satisfiable errors
    const duration = videoElement.duration || 0
    let seekTime = Math.min(Math.max(0, timeSeconds), duration - 0.1)
    // If seeking to the very start (0.0s), add a tiny offset to avoid range request issues
    if (seekTime === 0 && duration > 0.1) {
      seekTime = 0.1
    }
    
    let resolved = false
    let timeoutId = null
    
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId)
      thumbVideo.removeEventListener('seeked', onSeeked)
      thumbVideo.removeEventListener('error', onError)
      thumbVideo.removeEventListener('loadedmetadata', onLoadedMetadata)
      thumbVideo.removeEventListener('canplay', onCanPlay)
      thumbVideo.src = ''
      thumbVideo.load()
    }
    
    const captureFrame = () => {
      if (resolved) return
      
      try {
        // Ensure video is ready
        if (thumbVideo.readyState >= 2) {
          // Draw the video frame to canvas
          ctx.drawImage(thumbVideo, 0, 0, width, height)
          
          // Convert to data URL (should work now with CORS-enabled video)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
          
          resolved = true
          cleanup()
          resolve(dataUrl)
        } else {
          // Wait a bit more for video to be ready
          setTimeout(() => {
            if (!resolved && thumbVideo.readyState >= 2) {
              try {
                ctx.drawImage(thumbVideo, 0, 0, width, height)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
                resolved = true
                cleanup()
                resolve(dataUrl)
              } catch (error) {
                if (!resolved) {
                  resolved = true
                  cleanup()
                  reject(error)
                }
              }
            } else if (!resolved) {
              resolved = true
              cleanup()
              reject(new Error('Video not ready for frame capture'))
            }
          }, 200)
        }
      } catch (error) {
        if (!resolved) {
          resolved = true
          cleanup()
          reject(error)
        }
      }
    }
    
    const onLoadedMetadata = () => {
      // Wait a bit for the video to be fully ready before seeking
      // This helps avoid 416 Range Not Satisfiable errors
      setTimeout(() => {
        if (!resolved && thumbVideo.readyState >= 1) {
          const actualSeekTime = Math.min(Math.max(0, seekTime), thumbVideo.duration - 0.1)
          // Ensure we don't seek to exactly 0.0 if duration allows
          const finalSeekTime = actualSeekTime === 0 && thumbVideo.duration > 0.1 ? 0.1 : actualSeekTime
          thumbVideo.currentTime = finalSeekTime
        }
      }, 100)
    }
    
    // Also listen for canplay event as a fallback
    const onCanPlay = () => {
      if (!resolved && thumbVideo.currentTime === 0 && seekTime > 0) {
        const actualSeekTime = Math.min(Math.max(0, seekTime), thumbVideo.duration - 0.1)
        const finalSeekTime = actualSeekTime === 0 && thumbVideo.duration > 0.1 ? 0.1 : actualSeekTime
        thumbVideo.currentTime = finalSeekTime
      }
    }
    
    const onSeeked = () => {
      if (resolved) return
      
      // Small delay to ensure frame is rendered
      setTimeout(() => {
        if (!resolved) {
          captureFrame()
        }
      }, 50)
    }
    
    const onError = (e) => {
      if (!resolved) {
        resolved = true
        cleanup()
        const errorMsg = thumbVideo.error ? `Code ${thumbVideo.error.code}` : 'Unknown error'
        reject(new Error(`Failed to load video for thumbnail: ${errorMsg}. CORS may not be enabled on the video server.`))
      }
    }
    
    // Set a timeout to prevent hanging
    timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        cleanup()
        reject(new Error('Timeout while capturing video frame'))
      }
    }, 10000)
    
    // Add event listeners BEFORE loading
    thumbVideo.addEventListener('loadedmetadata', onLoadedMetadata)
    thumbVideo.addEventListener('canplay', onCanPlay)
    thumbVideo.addEventListener('seeked', onSeeked, { once: true })
    thumbVideo.addEventListener('error', onError, { once: true })
    
    // Load the video
    thumbVideo.src = videoUrl
    thumbVideo.load()
  })
}

/**
 * Captures a frame from a video URL at a specific timestamp and returns it as a data URL
 * This creates a new video element, so use captureVideoFrameFromElement if you already have a video element
 * @param {string} videoUrl - The URL of the video
 * @param {number} timeSeconds - The timestamp in seconds to capture
 * @param {number} width - Optional width for the thumbnail (default: 320)
 * @param {number} height - Optional height for the thumbnail (default: 180)
 * @returns {Promise<string>} - A data URL of the captured frame
 */
export async function captureVideoFrame(videoUrl, timeSeconds, width = 320, height = 180) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    
    let resolved = false
    
    const cleanup = () => {
      video.src = ''
      video.load()
      video.removeEventListener('loadedmetadata', onLoadedMetadata)
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
      video.removeEventListener('canplay', onCanPlay)
    }
    
    const onLoadedMetadata = () => {
      // Ensure we don't seek beyond video duration
      const seekTime = Math.min(Math.max(0, timeSeconds), video.duration - 0.1)
      video.currentTime = seekTime
    }
    
    const onCanPlay = () => {
      // Video is ready, try to seek
      if (video.readyState >= 2) {
        const seekTime = Math.min(Math.max(0, timeSeconds), video.duration - 0.1)
        video.currentTime = seekTime
      }
    }
    
    const onSeeked = () => {
      if (resolved) return
      
      try {
        // Ensure video is ready
        if (video.readyState >= 2) {
          // Draw the video frame to canvas
          ctx.drawImage(video, 0, 0, width, height)
          // Convert to data URL
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
          resolved = true
          cleanup()
          resolve(dataUrl)
        } else {
          // Wait a bit more
          setTimeout(() => {
            if (!resolved && video.readyState >= 2) {
              ctx.drawImage(video, 0, 0, width, height)
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
              resolved = true
              cleanup()
              resolve(dataUrl)
            }
          }, 200)
        }
      } catch (error) {
        if (!resolved) {
          resolved = true
          cleanup()
          reject(error)
        }
      }
    }
    
    const onError = (e) => {
      if (!resolved) {
        resolved = true
        cleanup()
        const errorMsg = video.error ? `Code ${video.error.code}: ${getVideoErrorText(video.error.code)}` : 'Unknown error'
        reject(new Error(`Failed to load video: ${errorMsg}`))
      }
    }
    
    // Set a timeout to prevent hanging
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        cleanup()
        reject(new Error('Timeout while capturing video frame'))
      }
    }, 15000)
    
    video.addEventListener('loadedmetadata', onLoadedMetadata)
    video.addEventListener('canplay', onCanPlay)
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('error', onError)
    
    video.src = videoUrl
    video.load()
  })
}

function getVideoErrorText(code) {
  const errorCodes = {
    1: 'MEDIA_ERR_ABORTED',
    2: 'MEDIA_ERR_NETWORK',
    3: 'MEDIA_ERR_DECODE',
    4: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
  }
  return errorCodes[code] || 'Unknown error'
}

/**
 * Generates thumbnails for multiple chapters from a video element (preferred method)
 * @param {HTMLVideoElement} videoElement - The video element to capture from
 * @param {Array<{title: string, startTime: number}>} chapters - Array of chapter objects with title and startTime
 * @param {number} width - Optional width for thumbnails (default: 320)
 * @param {number} height - Optional height for thumbnails (default: 180)
 * @returns {Promise<Array<{title: string, startTime: number, thumbnailUrl: string}>>} - Array of chapters with thumbnail URLs
 */
export async function generateChapterThumbnailsFromElement(videoElement, chapters, width = 320, height = 180) {
  const chaptersWithThumbnails = []
  
  // Ensure video is paused and ready
  const wasPlaying = !videoElement.paused
  if (wasPlaying) {
    videoElement.pause()
  }
  
  // Wait for video to be ready
  if (videoElement.readyState < 2) {
    await new Promise((resolve) => {
      const onCanPlay = () => {
        videoElement.removeEventListener('canplay', onCanPlay)
        resolve()
      }
      videoElement.addEventListener('canplay', onCanPlay)
    })
  }
  
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i]
    try {
      console.log(`Generating thumbnail ${i + 1}/${chapters.length} for "${chapter.title}" at ${chapter.startTime.toFixed(2)}s...`)
      
      // Wait a bit before each capture to ensure previous seek is complete
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
      
      const thumbnailUrl = await captureVideoFrameFromElement(videoElement, chapter.startTime, width, height)
      chaptersWithThumbnails.push({
        ...chapter,
        thumbnailUrl
      })
      console.log(`✓ Thumbnail generated for "${chapter.title}"`)
    } catch (error) {
      console.error(`✗ Failed to generate thumbnail for chapter "${chapter.title}" at ${chapter.startTime}s:`, error)
      // Add chapter without thumbnail if generation fails
      chaptersWithThumbnails.push({
        ...chapter,
        thumbnailUrl: null
      })
    }
  }
  
  // Restore video state
  videoElement.currentTime = 0
  if (wasPlaying) {
    videoElement.play().catch(() => {})
  }
  
  return chaptersWithThumbnails
}

/**
 * Generates thumbnails for multiple chapters from a video URL
 * @param {string} videoUrl - The URL of the video
 * @param {Array<{title: string, startTime: number}>} chapters - Array of chapter objects with title and startTime
 * @param {number} width - Optional width for thumbnails (default: 320)
 * @param {number} height - Optional height for thumbnails (default: 180)
 * @returns {Promise<Array<{title: string, startTime: number, thumbnailUrl: string}>>} - Array of chapters with thumbnail URLs
 */
export async function generateChapterThumbnails(videoUrl, chapters, width = 320, height = 180) {
  const chaptersWithThumbnails = []
  
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i]
    try {
      console.log(`Generating thumbnail ${i + 1}/${chapters.length} for "${chapter.title}" at ${chapter.startTime.toFixed(2)}s...`)
      const thumbnailUrl = await captureVideoFrame(videoUrl, chapter.startTime, width, height)
      chaptersWithThumbnails.push({
        ...chapter,
        thumbnailUrl
      })
      console.log(`✓ Thumbnail generated for "${chapter.title}"`)
    } catch (error) {
      console.error(`✗ Failed to generate thumbnail for chapter "${chapter.title}" at ${chapter.startTime}s:`, error)
      // Add chapter without thumbnail if generation fails
      chaptersWithThumbnails.push({
        ...chapter,
        thumbnailUrl: null
      })
    }
    
    // Small delay between captures to avoid overwhelming the browser
    if (i < chapters.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }
  
  return chaptersWithThumbnails
}

/**
 * Gets video duration from a video URL
 * @param {string} videoUrl - The URL of the video
 * @returns {Promise<number>} - The duration in seconds
 */
export function getVideoDuration(videoUrl) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    
    video.addEventListener('loadedmetadata', () => {
      const duration = video.duration
      video.src = ''
      video.load()
      resolve(duration)
    })
    
    video.addEventListener('error', (e) => {
      reject(new Error(`Failed to load video: ${e.message || 'Unknown error'}`))
    })
    
    setTimeout(() => {
      reject(new Error('Timeout while loading video metadata'))
    }, 10000)
    
    video.src = videoUrl
  })
}

/**
 * Automatically generates chapters by splitting video into equal segments
 * @param {number} duration - Video duration in seconds
 * @param {number} numChapters - Number of chapters to create
 * @param {string} baseTitle - Base title for chapters (e.g., "Chapter" will become "Chapter 1", "Chapter 2", etc.)
 * @returns {Array<{title: string, startTime: number}>} - Array of chapter objects
 */
export function generateEqualChapters(duration, numChapters, baseTitle = 'Chapter') {
  const chapters = []
  const segmentDuration = duration / numChapters
  
  for (let i = 0; i < numChapters; i++) {
    chapters.push({
      title: `${baseTitle} ${i + 1}`,
      startTime: i * segmentDuration
    })
  }
  
  return chapters
}

