<template>
    <NGErrorHandler v-if="error != null" :error="error" />
    <v-progress-linear indeterminate v-else-if="loading" />
    <v-container fluid v-else>
        <v-card class="pa-4">
            <div
                style="justify-items: center; align-items: center; vertical-align: center; display: flex;"
            >
                <div>
                    <v-img :src="channel.avatarUrl" height="48" width="48" class="rounded-circle" />
                </div>
                <span class="text-h5 ml-4">
                    {{ channel.name }}
                    <v-icon v-if="channel.verified">{{ mdiCheckCircleOutline }}</v-icon>
                    <br />
                    <span class="text-subtitle-1">
                        <ExpandableNumber :num="channel.subscriberCount" message-key="counts.subscribers" />
                    </span>
                </span>
                <ChannelSharingPanel :channel-id="channel.id" />
                <SubscriptionButton :channel-id="channel.id" />
                <v-btn outlined color="primary" link :href="unauthenticatedRSS" class="ml-2">{{ $t('actions.unauthenticated_rss') }}</v-btn>
            </div>
            <v-card-text>
                <div v-html="renderedDescription" />
            </v-card-text>
            <v-tabs center-active v-model="currentlySelectedTab">
                <v-tab v-for="tab in tabs" :key="tab.name">{{ tab.name }}</v-tab>
            </v-tabs>
        </v-card>

        <div v-if="view.videos" class="mt-2">
            <GridRow>
                <GridCol v-for="(video, videoId) in view.videos" :key="videoId">
                    <VideoItem :height="270" :width="480" :video="video" max-height v-if="video.type === 'stream'" />
                    <GenericDisplayItem :item="video" v-else />
                </GridCol>
            </GridRow>
            <v-progress-linear v-if="view.hasNextPage" indeterminate v-intersect="onRelatedStreamsEndIntersect" />
        </div>
    </v-container>
</template>

<script>
import { mdiCheckCircleOutline } from '@mdi/js'

import ExpandableNumber from '@/components/ExpandableNumber'
import NGErrorHandler from '@/components/NGErrorHandler'
import VideoItem from '@/components/Video/VideoItem.vue'
import GenericDisplayItem from '@/components/GenericDisplayItem'
import SubscriptionButton from '@/components/SubscriptionButton'
import GridRow from '@/components/Grid/GridRow'
import GridCol from '@/components/Grid/GridCol'
import ChannelSharingPanel from '@/components/ChannelSharingPanel'

import { LibPiped } from '@/tools/libpiped'

export default {
	name: 'ChannelComponent',
	data () {
		return {
			channel: null,
			error: null,

			loading: true,
			currentlySelectedTab: 0,
			tabs: [],

			mdiCheckCircleOutline
		}
	},
	metaInfo () {
		const title = this.channel ? this.channel.name : 'Loading'

		return {
			title,
			meta: this.channel && [
				{
					name: 'twitter:title',
					content: this.channel.name
				},
				{
					name: 'twitter:description',
					content: this.channel.description
				},
				{
					property: 'og:type',
					content: 'profile'
				},
				{
					property: 'og:title',
					content: this.channel.name
				},
				{
					property: 'og:profile:username',
					content: this.channel.name
				},
				{
					property: 'og:description',
					content: this.channel.description
				},
				{
					name: 'description',
					content: this.channel.description
				},
				{
					property: 'og:image',
					content: this.channel.bannerUrl
				},
				{
					name: 'twitter:image',
					content: this.channel.bannerUrl
				}
			]
		}
	},

	mounted () {
		this.fetchChannel()
	},
	watch: {
		'$route.params.channelId': 'fetchChannel',
		currentlySelectedTab: 'onTabChange'
	},
	methods: {
		async fetchChannel () {
			try {
				this.channel = await this.$store.dispatch('auth/makeRequest', {
					path: '/' + this.$route.params.path + '/' + this.$route.params.channelId
				})
				this.tabs = []
				this.currentlySelectedTab = 0
				this.tabs.push({
					originalName: '',
					name: this.$t('channel_tabs.videos')
				})
				for (const tab of this.channel.tabs) {
					tab.originalName = tab.name
					switch (tab.name) {
						case 'Livestreams':
						case 'livestreams':
							tab.name = this.$t('channel_tabs.livestreams')
							break
						case 'Playlists':
						case 'playlists':
							tab.name = this.$t('channel_tabs.playlists')
							break
						case 'Channels':
						case 'channels':
							tab.name = this.$t('channel_tabs.channels')
							break
						case 'Shorts':
						case 'shorts':
							tab.name = this.$t('channel_tabs.shorts')
							break
					}
					this.tabs.push(tab)
				}
				this.error = null
			} catch (e) {
				if (e.isAxiosError) {
					this.error = e.response.data != null ? e.response.data : e.toString()
				} else {
					throw e
				}
			} finally {
				this.loading = false
			}
		},

		onRelatedStreamsEndIntersect (entries) {
			if (entries[0].isIntersecting) {
				this.fetchMoreVideos()
			}
		},

		async onTabChange (newTab) {
			this.loading = true
			try {
				if (newTab === 0) {
					this.channelVideos = this.channel.relatedStreams
					return
				}
				const t = this.tabs[this.currentlySelectedTab]

				const { content, nextpage } = await this.$store.dispatch('auth/makeRequest', {
					method: 'GET',
					path: '/channels/tabs',
					params: {
						data: t.data
					}
				})
				t.videos = content
				t.nextpage = nextpage
			} finally {
				this.loading = false
			}
		},

		async fetchMoreVideos () {
			if (this.currentlySelectedTab === 0) {
				this.$store.dispatch('auth/makeRequest', {
					path: '/nextpage/channel/' + this.channel.id,
					params: {
						nextpage: this.channel.nextpage
					}
				}).then(j => {
					this.channel.relatedStreams = this.channel.relatedStreams.concat(j.relatedStreams)
					this.channel.nextpage = j.nextpage
				})
			} else {
				const t = this.tabs[this.currentlySelectedTab]
				this.$store.dispatch('auth/makeRequest', {
					path: '/channels/tabs',
					params: {
						data: t.data,
						nextpage: t.nextpage
					}
				}).then(j => {
					t.videos = t.videos.concat(j.relatedStreams)
					t.nextpage = j.nextpage
				})
			}
		}
	},
	computed: {
		renderedDescription () {
			return LibPiped.purifyHTML(LibPiped.markdown2HTML(this.channel.description))
		},

		unauthenticatedRSS () {
			const u = new URL('/feed/unauthenticated/rss', this.$store.getters['prefs/apiUrl'])
			u.searchParams.set('channels', this.channel?.id)
			return u.href
		},

		view () {
			if (this.currentlySelectedTab === 0) {
				return {
					videos: this.channel.relatedStreams,
					hasNextPage: this.channel.nextpage != null
				}
			} else {
				const t = this.tabs[this.currentlySelectedTab]
				return {
					videos: t.videos,
					hasNextPage: t.nextpage != null
				}
			}
		}
	},
	components: {
		GenericDisplayItem,
		ChannelSharingPanel,
		ExpandableNumber,
		GridRow,
		GridCol,
		SubscriptionButton,
		NGErrorHandler,
		VideoItem
	}
}
</script>
