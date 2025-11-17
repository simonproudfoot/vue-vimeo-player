<template>
 
  
  <!-- Vimeo Player (when using videoId) -->
  <VimeoPlayer 
    v-if="useVimeo"
    ref="playerRef" 
    :video-id="id" 
    @ready="onPlayerReady"
    @chapterchange="onChapterChange"
  />
  
  <!-- HTML5 Video Player (when using videoUrl) -->
  <video
    v-else-if="videoUrl"
    ref="videoPlayerRef"
    :src="videoUrl"
    controls
    class="video-player"
    @loadedmetadata="onVideoLoaded"
    @timeupdate="onVideoTimeUpdate"
  />
  
  <div v-if="chapters.length > 0" class="chapters-container">
    
    <div class="chapters-list">
      <button
        v-for="(chapter, index) in chapters"
        :key="index"
        @click="goToChapter(chapter)"
        :class="{ active: currentChapterIndex === index }"
        class="chapter-button"
      >
        <img 
          v-if="chapter.thumbnailUrl" 
          :src="chapter.thumbnailUrl" 
          :alt="chapter.title"
          class="chapter-thumbnail"
          @error="handleThumbnailError(chapter)"
        />
        <div v-else class="chapter-thumbnail-placeholder">
          <span>No thumbnail</span>
        </div>
        <div class="chapter-content">
          <span class="chapter-title">{{ chapter.title }}</span>
          <span class="chapter-time">{{ formatTime(chapter.startTime) }}</span>
        </div>
      </button>
    </div>
  </div>
  
  <div v-else-if="loadingChapters" class="loading">
    Loading chapters and generating thumbnails...
  </div>
  
  <div v-else-if="playerReady && !loadingChapters" class="no-chapters">
    No chapters available for this video
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { vueVimeoPlayer as VimeoPlayer } from '../../dist/index.es.js'
import { generateChapterThumbnails, generateChapterThumbnailsFromElement, getVideoDuration, generateEqualChapters } from './utils/videoThumbnails.js'

// Switch between Vimeo and standard video URL
const useVimeo = ref(false) // Set to false to use standard video URL
const id = ref('758682785')
const videoUrl = ref('/test-video.mp4') // Local video file - no CORS issues

const playerRef = ref(null)
const videoPlayerRef = ref(null)
const playerInstance = ref(null)
const playerReady = ref(false)
const chapters = ref([])
const loadingChapters = ref(false)
const currentChapterIndex = ref(-1)
const videoDuration = ref(0)

// Handle Vimeo player ready
const onPlayerReady = async (player) => {
  // Store the player instance from the ready event
  playerInstance.value = player
  playerReady.value = true
  loadingChapters.value = true
  
  try {
    // Fetch chapters from the player (this gives us basic chapter data)
    const chaptersData = await player.getChapters()
    console.log('Raw chapters data from Player.js:', chaptersData)
    
    // Fetch video thumbnail info first (shared for all chapters as fallback)
    let defaultThumbnail = null
    try {
      const response = await fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${id.value}`)
      const data = await response.json()
      defaultThumbnail = data.thumbnail_url
    } catch (error) {
      console.log('Could not fetch thumbnail from oEmbed')
    }
    
    // Try to fetch chapters from Vimeo REST API to get picture data
    // TODO: Replace with your Personal Access Token from https://developer.vimeo.com/apps/511667
    const accessToken = 'd61b2b0c6f20fdf476cb729ed70306df' // Replace with your actual token
    
    let apiChapters = null
    
    if (accessToken && accessToken !== 'd61b2b0c6f20fdf476cb729ed70306df') {
      try {
        // Fetch from Vimeo's API endpoint with authentication
        const apiResponse = await fetch(`https://api.vimeo.com/videos/${id.value}/chapters`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.vimeo.*+json;version=3.4'
          }
        })
        
        if (apiResponse.ok) {
          const apiData = await apiResponse.json()
          console.log('Vimeo API chapters data:', apiData)
          apiChapters = apiData.data || null
        } else {
          const errorData = await apiResponse.json().catch(() => ({}))
          console.error('Vimeo API error:', apiResponse.status, errorData)
          
          if (apiResponse.status === 401) {
            console.error('Authentication failed. Please check your access token is correct and has Public scope.')
          }
        }
      } catch (error) {
        console.error('Could not fetch chapters from Vimeo API:', error)
      }
    } else {
      console.warn('Vimeo access token not set. Replace YOUR_VIMEO_ACCESS_TOKEN_HERE with your actual token.')
    }
    
    // Map chapters with thumbnails
    // Since Vimeo API chapter thumbnails are returning 404s, use the default video thumbnail
    // In the future, if chapter-specific thumbnails become available, we can enhance this
    const chaptersWithThumbnails = (chaptersData || []).map((chapter, index) => {
      // Use the default video thumbnail for all chapters
      // The Vimeo API chapter thumbnails appear to be invalid/404ing
      const thumbnailUrl = defaultThumbnail || `https://vumbnail.com/${id.value}.jpg`
      
      return {
        ...chapter,
        thumbnailUrl,
        fallbackThumbnail: defaultThumbnail || `https://vumbnail.com/${id.value}.jpg`
      }
    })
    
    chapters.value = chaptersWithThumbnails
    console.log('Chapters loaded with thumbnails:', chapters.value)
  } catch (error) {
    console.error('Error fetching chapters:', error)
    chapters.value = []
  } finally {
    loadingChapters.value = false
  }
}

// Handle HTML5 video loaded
const onVideoLoaded = async () => {
  if (!videoPlayerRef.value) return
  
  playerReady.value = true
  loadingChapters.value = true
  
  try {
    const video = videoPlayerRef.value
    const duration = video.duration
    
    if (!duration || isNaN(duration)) {
      throw new Error('Could not determine video duration')
    }
    
    videoDuration.value = duration
    
    // Wait for video to be ready for seeking
    if (video.readyState < 2) {
      await new Promise((resolve) => {
        const onCanPlay = () => {
          video.removeEventListener('canplay', onCanPlay)
          resolve()
        }
        video.addEventListener('canplay', onCanPlay)
      })
    }
    
    // Define chapters - you can customize this
    // Option 1: Auto-generate equal chapters
    const numChapters = 5 // Adjust as needed
    const chapterDefinitions = generateEqualChapters(duration, numChapters, 'Chapter')
    
    // Option 2: Define custom chapters (uncomment and modify as needed)
    // const chapterDefinitions = [
    //   { title: 'Introduction', startTime: 0 },
    //   { title: 'Main Content', startTime: duration * 0.3 },
    //   { title: 'Conclusion', startTime: duration * 0.7 }
    // ]
    
    console.log('Video duration:', duration, 'seconds')
    console.log('Generating thumbnails for chapters:', chapterDefinitions)
    
    // Use the existing video element to generate thumbnails (more reliable than creating new elements)
    const chaptersWithThumbnails = await generateChapterThumbnailsFromElement(
      video,
      chapterDefinitions,
      320, // thumbnail width
      180  // thumbnail height
    )
    
    chapters.value = chaptersWithThumbnails
    console.log('Chapters loaded with thumbnails:', chapters.value)
    
    // Reset video to beginning
    video.currentTime = 0
  } catch (error) {
    console.error('Error generating chapters:', error)
    chapters.value = []
  } finally {
    loadingChapters.value = false
  }
}

// Handle video time updates to track current chapter
const onVideoTimeUpdate = () => {
  if (!videoPlayerRef.value) return
  
  const currentTime = videoPlayerRef.value.currentTime
  const index = chapters.value.findIndex(
    (chapter, idx) => {
      const nextChapter = chapters.value[idx + 1]
      return currentTime >= chapter.startTime && 
             (!nextChapter || currentTime < nextChapter.startTime)
    }
  )
  
  if (index !== -1 && currentChapterIndex.value !== index) {
    currentChapterIndex.value = index
  }
}

const handleThumbnailError = (chapter) => {
  // Fallback to the stored fallback thumbnail
  console.log('Thumbnail failed to load, using fallback:', chapter.title)
  
  if (chapter.fallbackThumbnail) {
    // If fallback also fails, try Vumbnail service
    if (chapter.thumbnailUrl === chapter.fallbackThumbnail) {
      // Already tried fallback, use Vumbnail
      chapter.thumbnailUrl = `https://vumbnail.com/${id.value}.jpg`
    } else {
      chapter.thumbnailUrl = chapter.fallbackThumbnail
    }
  } else {
    // Use Vumbnail as last resort
    chapter.thumbnailUrl = `https://vumbnail.com/${id.value}.jpg`
  }
}

const onChapterChange = (data) => {
  // Find the current chapter index based on the chapter data (Vimeo only)
  if (data && data.chapter) {
    const index = chapters.value.findIndex(
      ch => ch.startTime === data.chapter.startTime
    )
    if (index !== -1) {
      currentChapterIndex.value = index
    }
  }
}

const goToChapter = async (chapter) => {
  if (useVimeo.value) {
    // Vimeo player
    if (!playerRef.value || !playerRef.value.player) {
      console.error('Player instance not available via ref')
      if (!playerInstance.value) {
        console.error('Player instance not available at all')
        return
      }
    }
    
    const player = (playerRef.value && playerRef.value.player) || playerInstance.value
    
    try {
      console.log('Seeking to chapter:', chapter, 'at time:', chapter.startTime)
      await player.setCurrentTime(chapter.startTime)
      // Start playing after seeking
      await player.play()
      const index = chapters.value.findIndex(
        ch => ch.startTime === chapter.startTime
      )
      if (index !== -1) {
        currentChapterIndex.value = index
      }
    } catch (error) {
      console.error('Error seeking to chapter:', error)
    }
  } else {
    // HTML5 video player
    if (!videoPlayerRef.value) {
      console.error('Video player not available')
      return
    }
    
    try {
      const video = videoPlayerRef.value
      console.log('Seeking to chapter:', chapter, 'at time:', chapter.startTime)
      
      // Set the current time and wait for seek to complete
      video.currentTime = chapter.startTime
      
      // Wait for the seeked event before playing
      await new Promise((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked)
          resolve()
        }
        video.addEventListener('seeked', onSeeked, { once: true })
        
        // Fallback timeout in case seeked doesn't fire
        setTimeout(() => {
          video.removeEventListener('seeked', onSeeked)
          resolve()
        }, 500)
      })
      
      // Start playing after seek is complete
      try {
        const playPromise = video.play()
        if (playPromise !== undefined) {
          await playPromise
        }
      } catch (playError) {
        // If autoplay is blocked, log but don't fail
        console.warn('Autoplay was blocked:', playError)
        // The user interaction should allow play, so try again
        video.play().catch(() => {
          console.warn('Video play failed')
        })
      }
      
      const index = chapters.value.findIndex(
        ch => ch.startTime === chapter.startTime
      )
      if (index !== -1) {
        currentChapterIndex.value = index
      }
    } catch (error) {
      console.error('Error seeking to chapter:', error)
    }
  }
}

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
  padding: 20px;
}

.chapters-container {
  margin-top: 30px;
  text-align: center;
}

.chapters-container h2 {
  text-align: center;
  margin-bottom: 20px;
}

.chapters-list {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 6px;
  justify-content: center;
  max-width: 100%;
  margin: 0 auto;
  overflow-x: auto;
}

.chapter-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 10px;
  text-align: center;
  min-width: 70px;
  max-width: 70px;
  flex-shrink: 0;
}

.chapter-thumbnail {
  width: 100%;
  height: auto;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}

.chapter-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.chapter-button:hover {
  background: #e8e8e8;
  border-color: #42b983;
  transform: translateY(-3px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.chapter-button.active {
  background: #42b983;
  color: white;
  border-color: #42b983;
  font-weight: bold;
}

.chapter-title {
  font-weight: 500;
  text-align: center;
  font-size: 9px;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

.chapter-time {
  font-family: monospace;
  font-size: 8px;
  opacity: 0.7;
}

.loading,
.no-chapters {
  margin-top: 20px;
  color: #666;
  font-style: italic;
}

.video-player {
  width: 100%;
  max-width: 800px;
  height: auto;
  border-radius: 8px;
  margin: 0 auto;
  display: block;
}

.chapter-thumbnail-placeholder {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #e0e0e0;
  border-radius: 3px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  color: #999;
  text-align: center;
  padding: 2px;
}
</style>
