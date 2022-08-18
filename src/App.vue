<template>
    <v-app :style="bgStyles" v-if="initialized">
        <v-app-bar
            app
            dense
            color="appBarBG"
            v-if="$vuetify.breakpoint.width > 1000 && !$store.getters['prefs/isEmbedded']"
            class="desktop-buttons-container"
        >
            <v-btn icon link to="/" v-if="$store.getters['prefs/getPreferenceBoolean']('homepageButton')">
                <v-icon>
                    {{ mdiHome }}
                </v-icon>
            </v-btn>
            <v-btn
                v-for="link in links" :key="link.id"
                link
                text
                :to="link.to"
            >
                {{ $t(link.name) }}
            </v-btn>
            <AuthenticationModal />
            <v-btn icon @click="toggleDarkMode">
                <v-icon>{{ mdiBrightness6 }}</v-icon>
            </v-btn>
            <v-select
                class="mt-6"
                style="max-width: 15vw"
                dense
                :items="languageOptions"
                label="Language"
                :value="$i18n.locale"
                @input="changeLocale"
                outlined
            />
            <SearchMenu class="search-menu" />
            <!-- ^^^ The above breakpoint is manually determined to be the minimum sustainable width where everything works w/o overlapping -->
            <!-- Might need changing when buttons change -->
            <div class="desktop-buttons-container">
            </div>
        </v-app-bar>
        <div v-else-if="!$store.getters['prefs/isEmbedded']">
            <v-navigation-drawer
                v-model="drawer"
                app
            >
                <v-list nav>
                    <v-list-item
                        v-for="link in links"
                        :key="link.id"
                        link
                        :to="link.to"
                    >
                        {{ $t(link.name) }}
                    </v-list-item>
                    <AuthenticationModal :list-mode="true" />
                </v-list>
                <v-select
                    dense
                    outlined
                    class="mx-2 mt-2"
                    :label="$t('preferences.colorScheme')"
                    :value="$store.state.prefs.colorScheme"
                    @input="$store.commit('prefs/setColorScheme', { colorScheme: $event })"
                    :items="colorSchemeOptions"
                />
                <v-select
                    dense
                    :items="languageOptions"
                    label="Language"
                    :value="$i18n.locale"
                    @input="changeLocale"
                    outlined
                    class="mx-2"
                />
            </v-navigation-drawer>

            <v-app-bar app dense light color="#efcac3">
                <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>

                <v-toolbar-title>Piped-Material</v-toolbar-title>
                <v-spacer />
                <v-dialog
                    v-model="searchMenuOpened"
                    fullscreen hide-overlay
                    transition="dialog-bottom-transition"
                >
                    <template v-slot:activator="{ on, attrs }">
                        <v-btn
                            icon
                            large
                            v-bind="attrs"
                            v-on="on"
                            aria-label="Open Search Menu"
                        >
                            <v-icon>
                                {{ mdiMagnify }}
                            </v-icon>
                        </v-btn>
                    </template>
                    <v-card>
                        <v-toolbar
                            dark
                            color="primary"
                        >
                            <v-btn
                                icon
                                dark
                                @click="searchMenuOpened = false"
                            >
                                <v-icon>{{ mdiClose }}</v-icon>
                            </v-btn>
                            <v-toolbar-title>Search</v-toolbar-title>
                        </v-toolbar>
                        <v-card-text class="mt-2">
                            <SearchMenu @selected="searchMenuOpened = false" />
                        </v-card-text>
                    </v-card>
                </v-dialog>
            </v-app-bar>
        </div>

        <v-main>
            <router-view />
        </v-main>
    </v-app>
    <!-- Unfortunate this part can't be localized because i18n initialization depends on EDS information -->
    <v-app v-else>
        <v-main>
            <form style="max-width: 768px; margin: 0 auto;" @submit.prevent="maskedInitializeEDS" v-if="edsInfo.loading === false">
                <v-radio-group v-model="edsInfo.authType" row mandatory>
                    <v-radio label="(Browser) Web3 Wallet-based" :value="0" />
                    <v-radio label="(PBKDF) Username & Password-based" :value="1" />
                </v-radio-group>
                <span v-if="edsInfo.authType === 1">
                    <v-text-field label="Username (used as PBKDF2 salt)" hide-details="auto" v-model="edsInfo.username" type="text" />
                    <v-text-field label="Password (used as PBKDF2 password)" hide-details="auto" v-model="edsInfo.password" type="password" />
                    <p class="text-subtitle-1"><i>NOTE</i>: This page may freeze for a few seconds while the private key is computed.</p>
                </span>
                <v-text-field label="EDS URL (WARNING: PLEASE DOUBLE CHECK THE VALUE SINCE THIS MAY NOT BE CHANGE-ABLE AFTER INITIALIZATION)" hide-details="auto" v-model="edsInfo.url" type="url" />
                <v-btn type="submit" outlined class="mt-2">Submit</v-btn>
            </form>
            <div class="loader-svg-appvue" v-else>
                <svg class="circular">
                    <circle class="path" cx="50" cy="50" r="20" fill="none" stroke-width="5" stroke-miterlimit="10"></circle>
                </svg>
            </div>
        </v-main>
    </v-app>

</template>

<style lang="scss">
.desktop-buttons-container {
    * {
        margin-right: 4px;
    }

    :last-child {
        margin-right: 0;
    }
}

.loader-svg-appvue {
  $width: 100px;
  $green: #008744;
  $blue: #0057e7;
  $red: #d62d20;
  $yellow: #ffa700;
  $white: #eee;
  position: absolute;
  width: $width;
  height: $width;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);

  .circular {
    animation: rotate 2s linear infinite;
    height: $width;
    position: relative;
    width: $width;
  }

  .path {
    stroke-dasharray: 1, 200;
    stroke-dashoffset: 0;
    stroke: #b6463a;
    animation: dash 1.5s ease-in-out infinite, color 6s ease-in-out infinite;
    stroke-linecap: round;
  }

  @keyframes rotate {
    100% {
      transform: rotate(360deg);
    }
  }
  @keyframes dash {
    0% {
      stroke-dasharray: 1, 200;
      stroke-dashoffset: 0;
    }
    50% {
      stroke-dasharray: 89, 200;
      stroke-dashoffset: -35;
    }
    100% {
      stroke-dasharray: 89, 200;
      stroke-dashoffset: -124;
    }
  }
  @keyframes color {
    100%,
    0% {
      stroke: $red;
    }
    40% {
      stroke: $blue;
    }
    66% {
      stroke: $green;
    }
    80%,
    90% {
      stroke: $yellow;
    }
  }
}
</style>

<script>
import { mdiBrightness6, mdiMagnify, mdiClose, mdiHome } from '@mdi/js'

import SearchMenu from '@/routes/SearchMenu'
import AuthenticationModal from '@/components/AuthenticationModal'

import { COLOR_SCHEME_STATES } from '@/store/prefs-store'
import { syncPMDB } from '@/store/watched-videos-db'

import { initializeEDS } from '@/plugins/eds'
import { initializeLocalLocale, changeLocale, SUPPORTED_LANGUAGES } from '@/plugins/i18n'

export default {
	name: 'App',
	components: {
		AuthenticationModal,
		SearchMenu
	},
	metaInfo () {
		return {
			title: this.$t('titles.homepage'),
			// all titles will be injected into this template
			titleTemplate: '%s - Piped'
		}
	},

	data: () => ({
		initialized: false,
		drawer: false,
		// Only used on phones
		searchMenuOpened: false,
		edsInfo: {
			loading: false,

			authType: 1,
			url: process.env.VUE_APP_EDS_URL ?? 'wss://eds.gra.১.net:18001',
			username: '',
			password: ''
		},

		mdiBrightness6,
		mdiMagnify,
		mdiClose,
		mdiHome
	}),

	computed: {
		bgStyles () {
			return {
				backgroundColor: this.$vuetify.theme.currentTheme.bgOne
			}
		},

		colorSchemeOptions () {
			return [
				{ text: this.$t('actions.auto'), value: COLOR_SCHEME_STATES.SYSTEM },
				{ text: this.$t('actions.light'), value: COLOR_SCHEME_STATES.LIGHT },
				{ text: this.$t('actions.dark'), value: COLOR_SCHEME_STATES.DARK }
			]
		},

		links () {
			const links = [
				{
					id: 'trending',
					name: 'titles.trending',
					to: '/trending'
				},
				{
					id: 'prefs',
					name: 'titles.preferences',
					to: '/preferences'
				},
				{
					id: 'watch-history',
					name: 'titles.history',
					to: '/watch-history'
				}
			]

			if (this.$store.getters['auth/isCurrentlyAuthenticated']) {
				links.splice(0, 0, {
					id: 'feed',
					name: 'titles.feed',
					to: '/feed'
				})
				links.push({
					id: 'playlists',
					name: 'titles.playlists',
					to: '/playlists'
				})
			}

			return links
		},

		languageOptions () {
			return SUPPORTED_LANGUAGES.map(code => {
				return {
					text: this.$store.getters['i18n/fmtLanguage'](code),
					value: code
				}
			}).sort((a, b) => this.$store.getters['i18n/compare'](a.text, b.text))
		}
	},

	methods: {
		changeLocale (lang) {
			return changeLocale(lang)
		},

		toggleDarkMode () {
			let colorSchemeState
			const newDarkState = !this.$store.state.prefs.colorScheme

			if (newDarkState) {
				colorSchemeState = COLOR_SCHEME_STATES.DARK
			} else {
				colorSchemeState = COLOR_SCHEME_STATES.LIGHT
			}

			this.$store.commit('prefs/setColorScheme', {
				colorScheme: colorSchemeState
			})
		},

		syncDarkMode (newVal) {
			switch (newVal) {
				case COLOR_SCHEME_STATES.SYSTEM:
					this.$vuetify.theme.dark = window.matchMedia('(prefers-color-scheme: dark)').matches
					break
				case COLOR_SCHEME_STATES.DARK:
					this.$vuetify.theme.dark = true
					break
				case COLOR_SCHEME_STATES.LIGHT:
					this.$vuetify.theme.dark = false
					break
			}
		},

		// Ignores the event so we can use initializeEDS directly on create
		maskedInitializeEDS () {
			return this.initializeEDS()
		},

		initializeEDS (_params = null) {
			this.edsInfo.loading = true

			let params = _params
			if (params == null) {
				params = [{
					authType: this.edsInfo.authType,
					url: this.edsInfo.url
				}]

				switch (this.edsInfo.authType) {
					case 0:
						break
					case 1:
						params.push({
							username: this.edsInfo.username,
							password: this.edsInfo.password
						})
						break
				}
			}

			initializeEDS(...params)
				.then(() => Promise.all([
					syncPMDB(),
					this.$store.dispatch('prefs/loadState'),
					this.$store.dispatch('auth/initializeAuth'),
					initializeLocalLocale(),
					() => {
						this.$vuetify.rtl = this.$store.state.i18n.rtl
					},
					this.syncDarkMode()
				]))
				.then(() => {
					this.initialized = true
				})
		}
	},

	watch: {
		'$store.state.prefs.colorScheme': {
			handler (v) {
				return this.syncDarkMode(v)
			},
			immedate: true
		},
		'$store.state.i18n.rtl': {
			handler (newVal) {
				this.$vuetify.rtl = newVal
			},
			immediate: true
		}
	},

	created () {
		const edsParams = window.localStorage.getItem('EDS_PARAMS')
		if (edsParams != null) {
			this.initializeEDS(JSON.parse(edsParams))
		}
	}
}
</script>
