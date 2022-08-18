import { isString, set as _set } from 'lodash-es'
import { EDS } from '@/plugins/eds'

export const COLOR_SCHEME_STATES = {
	LIGHT: 0,
	DARK: 1,
	SYSTEM: 2
}

const PrefsStore = {
	namespaced: true,
	state: () => ({
		// Not a normal pref
		colorScheme: COLOR_SCHEME_STATES.SYSTEM,

		// Default values
		prefs: {
			playerAutoplay: true,
			autoplay: false,
			listen: false,
			sponsorblock: true,
			skipToLastPoint: true,
			clickbaitThumbnailAvoidance: false,
			disableDuplicateHistoryEntries: false,

			filterOutShortsInFeedPage: false,
			filterOutShortsInSearchResults: false,
			disableCommentsByDefault: false,
			showRelatedVideos: true,
			showMarkers: true,
			disableLBRY: true,
			proxyLBRY: true,
			homepageButton: false,
			enableCustomInstance: false,
			custom_instance_v1: '',

			selectedSkip: [],
			codecs: ['av01', 'avc1', 'vp9']
		}
	}),
	mutations: {
		setColorScheme (state, { colorScheme }) {
			state.colorScheme = colorScheme
			window.localStorage.setItem('COLOR_SCHEME', JSON.stringify(colorScheme))
		},

		setPrefs (state, {
			id,
			value
		}) {
			_set(state.prefs, id, value)
			EDS.setKey('preferences', state.prefs).catch(e => console.error(e))
		},

		replacePrefs (state, nextPrefs) {
			state.prefs = Object.assign({}, state.prefs, nextPrefs)
		}
	},
	actions: {
		async loadState ({ commit }) {
			try {
				const cs = window.localStorage.getItem('COLOR_SCHEME')
				if (isString(cs) && cs.length !== 0) {
					commit('setColorScheme', { colorScheme: JSON.parse(cs) })
				}

				const jv = await EDS.getKey('preferences')
				if (jv != null) {
					commit('replacePrefs', jv)
				}
			} catch (e) {
				console.log('Error:', e)
			}
		}
	},

	getters: {
		getPreference: state => (id, default_) => {
			const pref = state.prefs[id]
			return pref != null ? pref : default_
		},

		getPreferenceBoolean: (_, getters) => (...args) => {
			const v = getters.getPreference(...args)

			switch (v) {
				case 'true':
				case true:
				case '1':
				case 'on':
				case 'yes':
					return true
				default:
					return false
			}
		},

		getPreferenceNumber: (_, getters) => (id, default_) => {
			const v = getters.getPreference(id, default_)

			const n = Number(v)
			if (!Number.isFinite(n)) {
				return default_
			} else {
				return n
			}
		},

		apiUrl (state) {
			return state.prefs.instance ?? process.env.VUE_APP_PIPED_URL ?? 'https://pipedapi.kavin.rocks'
		},

		isEmbedded () {
			return window.self !== window.top
		}
	}
}

function initializePrefEvents (store) {
	window.addEventListener('storage', (storageEv) => {
		if (storageEv.key === 'COLOR_SCHEME') {
			store.commit('prefs/setColorScheme', {
				colorScheme: JSON.parse(storageEv.newValue)
			})
		}
	})
}

export {
	PrefsStore,
	initializePrefEvents
}
