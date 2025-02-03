<template>
	<NGErrorHandler :error="error" v-if="error != null" />
	<v-progress-linear indeterminate v-else-if="!loaded" />
	<div v-else>
		<Player ref="player" :video="video" :initial-skip="initialSkip" :sponsors="sponsors"
			:selectedAutoLoop="selectedAutoLoop"
			:audio-only="($store.getters['prefs/getPreferenceBoolean']('listen', false) || $route.query.listen === '1') && !video.livestream"
			@videoEnded="videoEnded" @timeupdate="onTimeUpdate" />

		<v-dialog max-width="960" v-model="sharingPanelOpen">
			<VideoSharingPanel @input="sharingPanelOpen = $event" :current-time="currentTime" :video-id="videoId" />
		</v-dialog>
		<VideoPlaylistOperationsA :dialog-open="playlistAddDialogOpen" @input="playlistAddDialogOpen = $event"
			:video-id="videoId" />
		<!-- <v-dialog max-width="720" v-model="playlistRemoveDialogOpen">
            <VideoSharingPanel @input="sharingPanelOpen = $event" :current-time="currentTime" :video-id="videoId" />
        </v-dialog> -->

		<v-row dense class="mb-2">
			<v-col md="10" offset-md="1">
				<v-card outlined color="bgTwo">
					<v-card-title class="text-h5">{{ video.title }}</v-card-title>
					<v-card-subtitle class="text-subtitle-1">
						<v-row align="center">
							<v-col cols="12" md="6">
								<ExpandableNumber :num="video.views" message-key="counts.views" />
								•
								{{ $store.getters['i18n/fmtDate'](video.uploadDate) }}
								<span v-if="lastWatchFound">
									•
									{{ $t('misc.lastWatchedTill', { t: lastWatchDurationH }) }}
									<ExpandableDate :date="lastWatch.timestamp" />
								</span>
								<span v-if="video.visibility !== 'public'">• {{ $t('visibilities.' + video.visibility)
								}}</span>
							</v-col>
							<v-col cols="12" md="6" :style="$vuetify.breakpoint.mdAndUp ? { textAlign: 'right' } : {}">
								<span style="vertical-align: middle">
									<v-icon>{{ mdiThumbUp }}</v-icon>
									<b class="ml-1">{{ $store.getters['i18n/fmtFullNumber'](video.likes) }}</b>
								</span>
								<v-btn outlined class="mt-1 ml-1" @click.stop="onShareClick">
									<v-icon class="mr-1">
										{{ mdiShareVariant }}
									</v-icon>
									{{ $t('video_sharing_panel.share') }}
								</v-btn>
								<v-btn outlined class="mt-1 ml-1" @click.stop="playlistAddDialogOpen = true"
									v-if="$store.getters['auth/isCurrentlyAuthenticated']">
									<v-icon class="mr-1">
										{{ mdiLinkPlus }}
									</v-icon>
									{{ $t('playlists.add_to_playlist') }}
								</v-btn>
								<v-btn class="mt-1 ml-1" link :href="'https://odysee.com/' + video.lbryId"
									v-if="video.lbryId" target="_blank" outlined>
									LBRY
								</v-btn>
								<v-tooltip bottom>
									<template v-slot:activator="{ on, attrs }">
										<v-btn class="mt-1 ml-1" @click="downloadAccess" outlined v-bind="attrs" v-on="on">
											M3U8/DASH/Stream
										</v-btn>
									</template>
									<span>
										With this you can play the video in your own media player.
									</span>
								</v-tooltip>
							</v-col>
						</v-row>
					</v-card-subtitle>
					<v-divider class="my-1" v-if="Array.isArray(video.chapters) && video.chapters.length !== 0" />
					<VideoChapters :chapters="video.chapters" @seek="$refs.player.skipToTime($event)"
						v-if="Array.isArray(video.chapters) && video.chapters.length !== 0" />
					<v-divider class="my-1" />
					<v-card-text>
						<router-link v-if="video.uploaderUrl" :to="video.uploaderUrl" custom v-slot="{ navigate }">
							<div style="justify-items: center; align-items: center; vertical-align: center; display: flex; cursor: pointer"
								@click="navigate" @keypress.enter="navigate" role="link">
								<div>
									<v-img :src="video.uploaderAvatar" height="48" width="48" class="rounded-circle" />
								</div>
								<a :href="video.uploaderUrl" class="text-h5 ml-4 text-decoration-none">
									{{ video.uploader }}
									<br />
									<span class="text-subtitle-1">
										<ExpandableNumber :num="video.uploaderSubscriberCount"
											message-key="counts.subscribers" />
									</span>
								</a>
								<div class="ml-4">
									<SubscriptionButton :channel-id="channelId" />
								</div>
							</div>
						</router-link>
						<div class="mt-4" dir="auto" v-html="video.description" />
						<v-divider class="my-4" />
						<div class="mt-4" v-if="showDesc && sponsors && sponsors.segments">
							Sponsors Segments: {{ sponsors.segments.length }}
						</div>
						<div>
							<!-- TODO translate -->
							<v-checkbox dense :input-value="isAutoplayEnabled" @change="onAutoplayChg"
								:label="$t('actions.autoplay_next_video')" hide-details />
							<v-checkbox dense :input-value="$store.getters['prefs/getPreferenceBoolean']('listen', false)"
								@change="onListenChg" :label="$t('preferences.listen')" hide-details />
							<v-checkbox dense v-model="selectedAutoLoop" :label="$t('actions.loop_this_video')"
								hide-details />
						</div>
					</v-card-text>
				</v-card>
			</v-col>
		</v-row>

		<v-row>
			<v-col cols="12" md="8" offset-md="1" v-if="commentsLoaded">
				<h5 class="text-h4 text-center my-4">{{ $t('actions.related_comments') }}</h5>
				<VideoComment v-for="comment in comments.comments" :key="comment.commentId" :comment="comment"
					:video="video" />
				<v-progress-linear indeterminate v-intersect="onCommentsProgressIntersect"
					v-if="comments.comments.length !== 0 && comments.nextpage != null" />
			</v-col>
			<v-col cols="12" md="8" offset-md="1" style="display: flex; justify-content: center"
				v-else-if="$store.getters['prefs/getPreferenceBoolean']('disableCommentsByDefault')">
				<v-btn x-large @click="fetchComments">{{ $t('actions.loadComments') }}</v-btn>
			</v-col>
			<v-col cols="12" md="2"
				v-if="video && video.relatedStreams && $store.getters['prefs/getPreferenceBoolean']('showRelatedVideos')">
				<h5 class="text-h4 text-center my-4">{{ $t('actions.related_videos') }}</h5>
				<VideoItem class="my-4" v-for="related in video.relatedStreams" :video="related" :key="related.url" />
			</v-col>
		</v-row>
	</div>
</template>

<script>
import throttle from 'lodash-es/throttle'
import { mdiLinkPlus, mdiShareVariant, mdiThumbUp } from '@mdi/js'

import { addWatchedVideo, findLastWatch, PMDB, updateWatchedVideoProgress } from '@/store/watched-videos-db'
import { LibPiped } from '@/tools/libpiped'

import Player from '@/components/Player.vue'
import NGErrorHandler from '@/components/NGErrorHandler'
import ExpandableDate from '@/components/ExpandableDate'
import ExpandableNumber from '@/components/ExpandableNumber'

import SubscriptionButton from '@/components/SubscriptionButton'
import VideoItem from '@/components/Video/VideoItem.vue'

import VideoComment from '@/components/Video/VideoComment'
import VideoChapters from '@/components/Video/VideoChapters'
import VideoSharingPanel from '@/components/Video/VideoSharingPanel'
import VideoPlaylistOperationsA from '@/components/Playlist/VideoPlaylistOperationsA'
import { getVideoData } from '@/store/yootoob-api'

export default {
	name: 'WatchVideo',
	data () {
		return {
			loaded: false,
			sharingPanelOpen: false,
			video: {
				title: 'Loading ...'
			},
			error: null,
			sponsors: null,
			selectedAutoLoop: false,
			showDesc: true,
			commentsLoaded: false,
			comments: null,
			channelId: null,

			// TODO: Refactor, this is miserable
			playlistAddDialogOpen: false,
			playlistRemoveDialogOpen: false,

			dbID: null,
			lastWatch: null,
			lastWatchFound: false,
			currentTime: null,

			mdiThumbUp,
			mdiShareVariant,
			mdiLinkPlus
		}
	},
	metaInfo () {
		return {
			title: this.video.title,
			meta: [
				{
					name: 'twitter:title',
					content: this.video.title
				},
				{
					name: 'twitter:description',
					content: this.video.description
				},
				{
					property: 'og:type',
					content: 'video'
				},
				{
					property: 'og:title',
					content: this.video.title
				},
				{
					property: 'og:description',
					content: this.video.description
				},
				{
					name: 'description',
					content: this.video.description
				},
				{
					property: 'og:image',
					content: this.video.thumbnailUrl
				},
				{
					name: 'twitter:image',
					content: this.video.thumbnailUrl
				}
			]
		}
	},

	mounted () {
		this.getVideoData()
	},
	watch: {
		'$route.query.v': function (v) {
			if (v) {
				window.scrollTo(0, 0)
			}
			this.getVideoData()
		}
	},
	methods: {
		videoEnded () {
			if (!this.selectedAutoLoop && this.isAutoplayEnabled && this.video.relatedStreams[0]) {
				this.$router.push({
					name: 'WatchVideo',
					query: {
						v: LibPiped.determineVideoIdFromPath(this.video.relatedStreams[0].url)
					}
				})
			}
		},

		onShareClick () {
			this.currentTime = this.$refs.player.getCurrentTime()
			this.sharingPanelOpen = true
		},

		async fetchVideo () {
			try {
				return await getVideoData(this.videoId)
			} catch (e) {
				if (e.isAxiosError) {
					this.error = e.response.data
				} else {
					throw e
				}
			}
		},

		async getSponsors () {
			if (!this.$store.getters['prefs/getPreference']('sponsorblock', true)) {
				return
			}
			const selectedSkip = this.$store.getters['prefs/getPreference']('selectedSkip')
			if (selectedSkip.length === 0) {
				return
			}
			try {
				this.sponsors = await this.$store.dispatch('auth/makeRequest', {
					path: '/sponsors/' + this.videoId,
					params: {
						category: JSON.stringify(selectedSkip)
					}
				})
			} catch (e) {
				// Just skip if sponsors are not available for some reason
				if (e.response?.status === 500) {
					this.sponsors = null
				} else {
					throw e
				}
			}
		},
		async fetchComments () {
			this.comments = await this.$store.dispatch('auth/makeRequest', {
				path: '/comments/' + this.videoId
			})
			this.commentsLoaded = true
		},

		onCommentsProgressIntersect (entries) {
			if (entries[0].isIntersecting) {
				this.fetchMoreComments()
			}
		},

		fetchMoreComments () {
			this.$store.dispatch('auth/makeRequest', {
				path: '/nextpage/comments/' + this.videoId,
				params: {
					nextpage: this.comments.nextpage
				}
			}).then(json => {
				this.comments.nextpage = json.nextpage
				this.comments.comments = this.comments.comments.concat(json.comments)
			})
		},

		onAutoplayChg (ev) {
			this.$store.commit('prefs/setPrefs', {
				id: 'autoplay',
				value: ev
			})
		},

		onListenChg (ev) {
			this.$store.commit('prefs/setPrefs', {
				id: 'listen',
				value: ev
			})
		},

		downloadAccess () {
			const [uri, mime] = this.$refs.player.getAccess()
			const a = document.createElement('a')
			a.href = uri
			a.target = '_blank'
			a.type = mime

			switch (mime) {
				case 'application/dash+xml':
					a.download = 'video.dash'
					break
				case 'application/x-mpegURL':
				default:
					a.download = 'video.m3u8'
					break
			}

			document.body.appendChild(a)
			a.click()
			document.body.removeChild(a)
		},

		async getVideoData () {
			const [videoResp] = await Promise.all([
				this.fetchVideo(),
				this.getSponsors(),
				(!this.$store.getters['prefs/getPreferenceBoolean']('disableCommentsByDefault'))
					? this.fetchComments()
					: null
			])
			console.log('Fetched Video Response:', videoResp)

			const video = videoResp.data.piped_fmt
			video.dash = videoResp.data.dash
			video.hls = videoResp.data.hls
			video.videoId = this.videoId
			video.url = this.$route.fullPath

			try {
				this.lastWatchFound = false
				if (!this.$store.getters['prefs/getPreference']('disableDuplicateHistoryEntries', false)) {
					this.lastWatch = await findLastWatch(this.videoId)
					if (this.lastWatch != null) {
						this.lastWatchFound = true
					}
					this.dbID = await addWatchedVideo(video)
				} else {
					let dbObj = await findLastWatch(this.videoId)

					if (dbObj == null) {
						this.dbID = await addWatchedVideo(video)
						dbObj = await findLastWatch(this.videoId)
					} else {
						this.dbID = dbObj.id
						this.lastWatchFound = true
					}

					const ts = new Date()
					await PMDB.watchedVideos.update(this.dbID, {
						timestamp: ts,
						video
					})
					dbObj.timestamp = ts
					dbObj.video = video
					this.lastWatch = dbObj
					this.dbID = dbObj.id
				}
			} catch (e) {
				console.error('Errored while finding last watched', e)
			}

			this.video = video
			this.loaded = true

			if (this.video.error) {
				return
			}
			this.channelId = this.video.uploaderID

			this.video.description = LibPiped.purifyHTML(LibPiped.markdown2HTML(
				this.video.description
					.replaceAll('http://www.youtube.com', '')
					.replaceAll('https://www.youtube.com', '')
					.replaceAll('\n', '<br>')
			))
		},

		onTimeUpdate: throttle(function onTimeUpdate () {
			if (this.dbID == null || !this.$refs.player) {
				return
			}
			return updateWatchedVideoProgress(this.dbID, this.$refs.player.getCurrentTime(), this.video.duration)
		}, 5000)
	},
	computed: {
		isAutoplayEnabled () {
			return this.$store.getters['prefs/getPreferenceBoolean']('autoplay', false)
		},
		videoId () {
			return this.$route.query.v || this.$route.params.v
		},
		initialSkip () {
			// “t” in $route.query ? Number($route.query.t) : (lastWatch.progress ? lastWatch.progress : undefined)
			// 1st Priority – t in query
			// 2nd Priority – Last Watched Progress, if enabled.
			if ('t' in this.$route.query) {
				return Number(this.$route.query.t)
			} else if ('start' in this.$route.query) {
				return Number(this.$route.query.start)
			} else if (this.lastWatch && this.lastWatch.progress != null && this.lastWatch.progress !== 0 && this.$store.getters['prefs/getPreferenceBoolean']('skipToLastPoint', true)) {
				return this.lastWatch.progress
			} else {
				return undefined
			}
		},

		lastWatchDurationH () {
			return this.$store.getters['i18n/fmtDuration'](this.lastWatch.progress)
		}
	},
	components: {
		ExpandableNumber,
		VideoPlaylistOperationsA,
		VideoChapters,
		VideoSharingPanel,
		ExpandableDate,
		SubscriptionButton,
		VideoComment,
		Player,
		VideoItem,
		NGErrorHandler
	}
}
</script>
