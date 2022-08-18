import axios from 'axios'
import { isPlainObject as _isPlainObject, set as _set } from 'lodash-es'
import { EDS } from '@/plugins/eds'

export class AuthenticationError extends Error {
	constructor (message) {
		super()
		this.message = message
	}
}

const AuthenticationStore = {
	namespaced: true,

	state: () => ({
		authStateByInstance: {
			// isAuthenticated: Boolean
			// authToken: String?
		}
	}),

	mutations: {
		replaceAuth (state, data) {
			state.authStateByInstance = data
		},

		setAuthToken (state, { apiURL, token }) {
			_set(state.authStateByInstance, [apiURL], {
				isAuthenticated: true,
				authToken: token
			})
			EDS.setKey('AUTH', state.authStateByInstance).catch(e => console.error(e))
		},

		deleteAuthToken (state, { apiURL }) {
			_set(state.authStateByInstance, [apiURL], {
				isAuthenticated: false
			})
			EDS.setKey('AUTH', state.authStateByInstance).catch(e => console.error(e))
		}
	},

	getters: {
		isCurrentlyAuthenticated (state, _, _2, rootGetters) {
			const s = state.authStateByInstance[rootGetters['prefs/apiUrl']]
			return s ? (s.isAuthenticated === true) : false
		},

		authToken (state, _, _2, rootGetters) {
			const authState = state.authStateByInstance[rootGetters['prefs/apiUrl']] || {}
			return authState.authToken
		}
	},

	actions: {
		async initializeAuth ({ commit }) {
			const data = await EDS.getKey('AUTH')
			if (data != null) {
				commit('replaceAuth', data)
			}
		},

		async loginOrRegister ({ commit, rootGetters }, { path, username, password }) {
			const apiURL = rootGetters['prefs/apiUrl']
			let resp
			try {
				const data = await axios({
					method: 'POST',
					baseURL: apiURL,
					url: '/' + path,
					data: {
						username,
						password
					}
				})
				resp = data.data
			} catch (e) {
				if (e.response.status === 400 || e.response.status === 401) {
					const errorData = e.response.data
					if ('error' in errorData) {
						throw new AuthenticationError(errorData.error)
					}
				}
				throw e
			}

			if ('error' in resp) {
				throw new AuthenticationError(resp.error)
			}

			commit('setAuthToken', {
				apiURL,
				token: resp.token
			})
			setTimeout(() => {
				window.location.reload()
			}, 1000)
		},

		async makeRequest ({
			state,
			rootGetters
		}, {
			path,
			method,
			data,
			params,
			signal,
			tokenInParams = false
		}) {
			const APIURL = rootGetters['prefs/apiUrl']
			const AuthState = state.authStateByInstance[APIURL] || {}

			if (AuthState.isAuthenticated && tokenInParams) {
				if (_isPlainObject(params)) {
					params.authToken = AuthState.authToken
				} else {
					params = {
						authToken: AuthState.authToken
					}
				}
			}

			const { data: resp } = await axios({
				baseURL: APIURL,
				method,
				url: path,
				params,
				data,
				signal,
				headers: AuthState.isAuthenticated
					? {
							Authorization: AuthState.authToken
						}
					: undefined
			})

			return resp
		}
	}
}

export {
	AuthenticationStore
}
