<template>
  <div
    data-shaka-player-container
    style="width: 100%; height: calc(100vh - 48px); background: #000; direction: ltr"
    ref="container"
  >
    <canvas ref="preview" class="pm-shaka-preview rounded-xl" style="display: none" />
    <video
      data-shaka-player
      style="min-width: 100%;"
      :autoplay="shouldAutoPlay"
      :loop="selectedAutoLoop"
      ref="videoEl"
    ></video>
  </div>
</template>

<script>
import QuickLRU from 'quick-lru'
import shaka from 'shaka-player/dist/shaka-player.ui.js'
import 'shaka-player/dist/controls.css'
import * as LocaleMatcher from '@formatjs/intl-localematcher'

import '@/components/Player.scss'

// Fonts for Shaka
import '@fontsource/material-icons-round/index.css'

import { setupKeybindings } from 'psychic-tiny-keys'

if (!window.muxjs) {
	import('mux.js').then(m => {
		window.muxjs = m
	})
}

const ImageLRU = new QuickLRU({ maxSize: 8 })

export default {
	props: {
		video: Object,
		sponsors: Object,
		audioOnly: Boolean,
		initialSkip: Number,
		selectedAutoLoop: Boolean
	},
	data () {
		return {
			$player: null,
			$ui: null,
			onTimeBar: false,
			access: []
		}
	},
	computed: {
		shouldAutoPlay () {
			return this.$store.getters['prefs/getPreferenceBoolean']('playerAutoplay', true) && !this.$store.getters['prefs/isEmbedded']
		},

		preferredVideoCodecs () {
			const enabledCodecs = new Set(this.$store.getters['prefs/getPreference']('codecs'))
			const preferredVideoCodecs = []
			if (this.$refs.videoEl.canPlayType('video/mp4; codecs="av01.0.08M.08"') !== '' && enabledCodecs.has('av01')) { preferredVideoCodecs.push('av01') }
			if (this.$refs.videoEl.canPlayType('video/webm; codecs="vp9"') !== '' && enabledCodecs.has('vp9')) preferredVideoCodecs.push('vp9')
			if (this.$refs.videoEl.canPlayType('video/mp4; codecs="avc1.4d401f"') !== '' && enabledCodecs.has('avc1')) { preferredVideoCodecs.push('avc1') }
			return preferredVideoCodecs
		},

		shouldShowMarkers () {
			return this.$store.getters['prefs/getPreferenceBoolean']('showMarkers', true) && this.$store.getters['prefs/getPreferenceBoolean']('sponsorblock', true)
		}
	},
	methods: {
		getCurrentTime () {
			// UNCLEAN
			return this.$refs.videoEl ? this.$refs.videoEl.currentTime : undefined
		},

		getAccess () {
			return this.access
		},

		skipToTime (timeInSeconds) {
			this.$refs.videoEl.currentTime = timeInSeconds
		},

		// Most of the below ‘Storyboard’ code is from PR 2559 and PR 2355 in Piped, some minor algorithmic and seekbar positioning improvements have been added
		// The ‘Storyboard’ setup – Start
		setupSeekbarPreview () {
			if (!this.video.previewFrames) return
			const seekBar = document.querySelector('.shaka-seek-bar-container')
			// load the thumbnail preview when the user moves over the seekbar
			seekBar.addEventListener('mousemove', e => {
				this.onTimeBar = true
				const position = (e.offsetX / e.target.offsetWidth) * this.video.duration
				this.showSeekbarPreview(position * 1000, e.clientX)
			})
			// hide the preview when the user stops hovering the seekbar
			seekBar.addEventListener('mouseout', () => {
				this.onTimeBar = false
				this.$refs.preview.style.display = 'none'
			})
		},

		async showSeekbarPreview (position, psx) {
			const frame = this.getFrame(position)
			const originalImage = await this.getOrLoadImage(frame.url)
			const seekBar = document.querySelector('.shaka-seek-bar-container')
			const canvas = this.$refs.preview
			const ctx = canvas.getContext('2d')

			// get the new sizes for the image to be drawn into the canvas
			const originalWidth = originalImage.naturalWidth
			const originalHeight = originalImage.naturalHeight
			// the preview image can have less frames than server responded so we calculate them ourselves
			const imageFramesPerPageX = originalWidth / frame.frameWidth
			const imageFramesPerPageY = originalHeight / frame.frameHeight
			const offsetX = originalWidth * (frame.positionX / imageFramesPerPageX)
			const offsetY = originalHeight * (frame.positionY / imageFramesPerPageY)

			// draw the thumbnail preview into the canvas by cropping only the relevant part
			canvas.width = frame.frameWidth > 100 ? frame.frameWidth : frame.frameWidth * 2
			canvas.height = frame.frameWidth > 100 ? frame.frameHeight : frame.frameHeight * 2
			ctx.drawImage(originalImage, offsetX, offsetY, frame.frameWidth, frame.frameHeight, 0, 0, canvas.width, canvas.height)

			const seekBarRect = seekBar.getBoundingClientRect()
			const left = psx - (canvas.width / 2)
			const seekbarRight = seekBarRect.right - canvas.width
			const adjusted = left < seekBarRect.left ? seekBarRect.left : (left > seekbarRight ? seekbarRight : left)
			canvas.style.left = adjusted.toString() + 'px'

			// If the user has navigated out of the time-bar by now (since the above operations are fairly expensive, exit)
			if (this.onTimeBar === false) {
				return
			}
			canvas.style.display = 'block'
		},

		// ineffective algorithm to find the thumbnail corresponding to the currently hovered position in the video
		getFrame (position) {
			let startPosition = 0
			const framePage = this.video.previewFrames.at(-1)
			for (let i = 0; i < framePage.urls.length; i++) {
				for (let positionY = 0; positionY < framePage.framesPerPageY; positionY++) {
					for (let positionX = 0; positionX < framePage.framesPerPageX; positionX++) {
						const endPosition = startPosition + framePage.durationPerFrame
						if (position >= startPosition && position <= endPosition) {
							return {
								url: framePage.urls[i],
								positionX,
								positionY,
								frameWidth: framePage.frameWidth,
								frameHeight: framePage.frameHeight
							}
						}
						startPosition = endPosition
					}
				}
			}
			return null
		},
		// creates a new image from an URL
		async loadImage (url) {
			const i = new Image()
			i.src = url
			await i.decode()
			return i
		},

		// The ‘Storyboard’ setup – End

		async getOrLoadImage (url) {
			let img = ImageLRU.get(url)
			if (img == null) {
				img = await this.loadImage(url)
				ImageLRU.set(url, img)
			}
			return img
		},

		async loadVideo () {
			console.log('PM | LOADING VIDEO')
			const component = this
			const videoEl = this.$refs.videoEl

			videoEl.setAttribute('poster', this.video.thumbnailUrl)

			const noPrevPlayer = !this.$player

			let uri, mime

			if (this.video.livestream) {
				uri = this.video.hls
				mime = 'application/x-mpegURL'
			} else if (this.video.dash) {
				uri = this.video.dash
				mime = 'application/dash+xml'
			} else if (this.video.hls) {
				uri = this.video.hls
				mime = 'application/x-mpegURL'
			}
			this.access = [uri, mime]

			if (noPrevPlayer) {
				shaka.polyfill.installAll()

				const localPlayer = new shaka.Player(videoEl)
				const proxyHost = new URL(component.video.proxyUrl).host

				localPlayer.getNetworkingEngine().registerRequestFilter((_type, request) => {
					const uri = request.uris[0]
					const url = new URL(uri)
					const headers = request.headers
					if (
						url.host.endsWith('.googlevideo.com') || (url.host.endsWith('.lbryplayer.xyz') && (this.$store.getters['prefs/getPreferenceBoolean']('proxyLBRY', true) || headers.Range))
					) {
						url.searchParams.set('host', url.host)
						url.host = proxyHost
						request.uris[0] = url.toString()
					}

					if (url.pathname === '/videoplayback') {
						if (headers.Range) {
							url.searchParams.set('range', headers.Range.split('=')[1])
							request.headers = {}
							request.uris[0] = url.toString()
						}
					}
				})

				localPlayer.configure(
					'streaming.bufferingGoal',
					this.$store.getters['prefs/getPreferenceNumber']('bufferGoal', 10)
				)

				this.setPlayerAttrs(localPlayer, videoEl, uri, mime, shaka)
			} else this.setPlayerAttrs(this.$player, videoEl, uri, mime, shaka)

			if (noPrevPlayer) {
				videoEl.addEventListener('timeupdate', (ev) => {
					if (this.sponsors && this.sponsors.segments) {
						const time = videoEl.currentTime
						this.sponsors.segments.forEach(segment => {
							if (!segment.skipped || this.selectedAutoLoop) {
								const end = segment.segment[1]
								if (time >= segment.segment[0] && time < end) {
									console.log('Skipped segment at ' + time)
									videoEl.currentTime = end
									segment.skipped = true
								}
							}
						})
					}
					this.$emit('timeupdate', ev)
				})

				videoEl.addEventListener('volumechange', () => {
					this.$store.commit('prefs/setPrefs', {
						id: 'volume',
						value: videoEl.volume
					})
				})

				videoEl.addEventListener('ratechange', (e) => {
					const rate = videoEl.playbackRate
					if (!(rate > 0 && !Number.isNaN(videoEl.duration) && !Number.isNaN(videoEl.duration - e.timeStamp / 1000))) {
						return
					}
					this.$store.commit('prefs/setPrefs', {
						id: 'rate',
						value: videoEl.playbackRate
					})
				})

				videoEl.addEventListener('ended', () => {
					this.$emit('videoEnded')
				})
			}

			this.createMarkers()
		},
		setPlayerAttrs (localPlayer, videoEl, uri, mime, shaka) {
			if (!this.$ui) {
				this.destroy()
				this.$ui = new shaka.ui.Overlay(localPlayer, this.$refs.container, videoEl)

				const overflowMenuButtons = [
					'quality',
					'language',
					'captions',
					'picture_in_picture',
					'playback_rate',
					'airplay'
				]

				const config = {
					overflowMenuButtons,
					seekBarColors: {
						base: 'rgba(255, 255, 255, 0.3)',
						buffered: 'rgba(255, 255, 255, 0.54)',
						played: 'rgb(255, 0, 0)'
					}
				}

				this.$ui.configure(config)
			}

			const player = this.$ui.getControls().getPlayer()

			this.setupSeekbarPreview()
			this.$player = player

			const startTime = this.initialSkip != null && Number.isFinite(this.initialSkip) ? this.initialSkip : 0
			this.skipToTime(startTime)

			this.$player.configure({
				preferredVideoCodecs: this.preferredVideoCodecs,
				preferredAudioCodecs: ['opus', 'mp4a'],
				manifest: {
					disableVideo: this.audioOnly
				},
				streaming: {
					useNativeHlsOnSafari: false,
					retryParameters: {
						timeout: 120_000,
						stallTimeout: 30_000,
						connectionTimeout: 120_000
					}
				}
			})

			const quality = this.$store.getters['prefs/getPreferenceNumber']('quality', 0)
			const qualityConds = quality > 0 && !this.video.livestream && !this.audioOnly
			if (qualityConds) this.$player.configure('abr.enabled', false)

			player.load(uri, startTime, mime).then(() => {
				let bestFitLanguage
				{
					const langs = player.getAudioLanguages()
					bestFitLanguage = LocaleMatcher.match(this.$store.state.i18n.locale, langs, 'en')
					player.selectAudioLanguage(bestFitLanguage)
				}

				if (qualityConds) {
					let leastDiff = Number.MAX_VALUE
					let bestStream = null

					let bestAudio = 0
					const tracks = player
						.getVariantTracks()
						.filter(track => track.language === bestFitLanguage || track.language === 'und')

					console.log('Tracks:', tracks)

					// Choose the best audio stream
					if (quality >= 480) {
						tracks.forEach(track => {
							const audioBandwidth = track.audioBandwidth
							if (audioBandwidth > bestAudio) bestAudio = audioBandwidth
						})
					}

					tracks
						.sort((a, b) => a.bandwidth - b.bandwidth)
						.forEach(stream => {
							if (stream.audioBandwidth < bestAudio) return

							const diff = Math.abs(quality - stream.height)
							if (diff < leastDiff) {
								leastDiff = diff
								bestStream = stream
							}
						})

					player.selectVariantTrack(bestStream)
				}

				this.video.subtitles.forEach(subtitle => {
					player.addTextTrackAsync(
						subtitle.url,
						subtitle.code,
						'subtitles',
						subtitle.mimeType,
						null,
						subtitle.name
					)
				})
				videoEl.volume = this.$store.getters['prefs/getPreferenceNumber']('volume', 1)

				{
					const rate = this.$store.getters['prefs/getPreferenceNumber']('rate', 1)
					videoEl.playbackRate = rate
					videoEl.defaultPlaybackRate = rate
				}
			})
		},

		createMarkers () {
			const markers = this.$refs.container.querySelector('.shaka-ad-markers')
			if (!this.shouldShowMarkers) {
				markers.style.background = 'none'
				return false
			}

			const array = ['to right']
			this.sponsors?.segments?.forEach(segment => {
				const start = (segment.segment[0] / this.video.duration) * 100
				const end = (segment.segment[1] / this.video.duration) * 100
				let color
				switch (segment.category) {
					case 'sponsor':
						color = '#b8bb26'
						break
					case 'selfpromo':
						color = '#fabd2f'
						break
					case 'interaction':
						color = '#d3869b'
						break
					case 'poi_highlight':
						color = '#b16286'
						break
					case 'intro':
						color = '#83A598'
						break
					case 'outro':
						color = '#8ec07c'
						break
					case 'preview':
						color = '#458588'
						break
					case 'filler':
						color = '#689d6a'
						break
					case 'music_offtopic':
						color = '#fe8019'
						break
					default:
						color = '#fbf1c7'
				}
				array.push(`transparent ${start}%`)
				array.push(`${color} ${start}%`)
				array.push(`${color} ${end}%`)
				array.push(`transparent ${end}%`)
			})
			if (array.length <= 1) {
				return
			}
			markers.style.background = `linear-gradient(${array.join(',')})`
		},

		destroy () {
			if (this.$ui) {
				this.$ui.destroy()
				this.$ui = undefined
				this.$player = undefined
			}
			if (this.$player) {
				this.$player.destroy()
				this.$player = undefined
			}
			if (this.$refs.container) this.$refs.container.querySelectorAll('div').forEach(node => node.remove())
		}
	},

	watch: {
		'video.videoId': 'loadVideo',
		audioOnly: 'loadVideo',
		shouldShowMarkers: 'createMarkers'
	},

	mounted () {
		this.loadVideo()
		const self = this
		const videoEl = self.$refs.videoEl
		const onSpace = (e) => {
			if (videoEl.paused) videoEl.play()
			else videoEl.pause()
			e.preventDefault()
		}

		this.unsubToKeybindings = setupKeybindings(window, {
			f (e) {
				if (document.fullscreenElement) document.exitFullscreen()
				else self.$refs.container.requestFullscreen()
				e.preventDefault()
			},
			m (e) {
				videoEl.muted = !videoEl.muted
				e.preventDefault()
			},
			j (e) {
				videoEl.currentTime = Math.max(videoEl.currentTime - 15, 0)
				e.preventDefault()
			},
			l (e) {
				videoEl.currentTime = videoEl.currentTime + 15
				e.preventDefault()
			},
			c (e) {
				self.$player.setTextTrackVisibility(!self.$player.isTextTrackVisible())
				e.preventDefault()
			},
			Space: onSpace,
			k: onSpace,
			ArrowUp (e) {
				videoEl.volume = Math.min(videoEl.volume + 0.05, 1)
				e.preventDefault()
			},
			ArrowDown (e) {
				videoEl.volume = Math.max(videoEl.volume - 0.05, 0)
				e.preventDefault()
			},
			ArrowLeft (e) {
				videoEl.currentTime = Math.max(videoEl.currentTime - 5, 0)
				e.preventDefault()
			},
			ArrowRight (e) {
				videoEl.currentTime = videoEl.currentTime + 5
				e.preventDefault()
			},
			'Shift+>' (e) {
				self.$player.trickPlay(Math.min(videoEl.playbackRate + 0.25, 2))
				e.preventDefault()
			},
			'Shift+<' (e) {
				self.$player.trickPlay(Math.max(videoEl.playbackRate - 0.25, 0.25))
				e.preventDefault()
			}
		})
	},

	beforeDestroy () {
		this.destroy()
		if (this.unsubToKeybindings) this.unsubToKeybindings()
	}
}
</script>
