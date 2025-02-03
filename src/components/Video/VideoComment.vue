<template>
    <v-row align="center" justify="center" no-gutters>
        <v-col cols="4" md="1">
            <v-avatar size="90%" class="mx-3">
                <img :src="comment.thumbnail"/>
            </v-avatar>
        </v-col>
        <v-col cols="12" md="11">
            <v-card-text>
                <v-icon v-if="comment.pinned" class="mx-2">{{ mdiPin }}</v-icon>
                <router-link :to="comment.commentorUrl" class="text-decoration-none primary--text">
                    <b>{{ comment.author }}</b>
                    <v-icon v-if="comment.verified">{{ mdiAccountCheck }}</v-icon>
                </router-link>
                {{ comment.commentedTime }}

                <div v-html="renderedCommentTxt"/>

                <v-divider class="my-2"/>

                <v-icon>{{ mdiThumbUp }}</v-icon>
                {{ this.$store.getters['i18n/fmtFullNumber'](comment.likeCount) }}
                <v-icon v-if="comment.hearted" class="ml-4">{{ mdiHeart }}</v-icon>
                <br/>
                <v-btn
                        class="mt-1" text :loading="requestInProgress" :disabled="requestInProgress"
                        @click="loadReplies"
                        v-if="!subComment && childComments.length === 0 && comment.repliesPage != null"
                >

                    {{ $t('actions.loadReplies')}}
                </v-btn>
                <div v-else-if="!subComment && childComments.length !== 0">
                    <v-btn text @click="showChildComments = !showChildComments">
                        {{ $t('actions.' + (showChildComments ? 'hide' : 'show') + 'Replies') }}
                    </v-btn>
                </div>
                <div v-if="childComments.length !== 0 && showChildComments">
                    <video-comment
                            :comment="childComment" :video="video" :sub-comment="true"
                            v-for="(childComment) in childComments" :key="childComment.commentId"
                    />
                </div>
            </v-card-text>
        </v-col>
    </v-row>
</template>

<script>
import { mdiPin, mdiAccountCheck, mdiHeart, mdiThumbUp } from '@mdi/js'

import { LibPiped } from '@/tools/libpiped'

export default {
	name: 'VideoComment',
	props: ['comment', 'video', 'subComment'],
	data: () => ({
		requestInProgress: false,
		showChildComments: true,
		childComments: [],

		mdiPin,
		mdiAccountCheck,
		mdiHeart,
		mdiThumbUp
	}),
	methods: {
		async loadReplies () {
			let nextpage = null
			this.requestInProgress = true

			while (true) {
				const replies = await this.$store.dispatch('auth/makeRequest', {
					method: 'GET',
					path: '/nextpage/comments/' + this.video.videoId,
					params: {
						nextpage: nextpage || this.comment.repliesPage
					}
				})

				this.childComments = this.childComments.concat(replies.comments)
				if (replies.nextpage) {
					nextpage = replies.nextpage
				} else {
					break
				}
			}
			this.requestInProgress = false
		}
	},

	computed: {
		renderedCommentTxt () {
			return LibPiped.purifyHTML(LibPiped.markdown2HTML(this.comment.commentText))
		}
	}
}
</script>
