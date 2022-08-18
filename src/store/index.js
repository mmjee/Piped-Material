import Vue from 'vue'
import Vuex from 'vuex'

import { initializePrefEvents, PrefsStore } from '@/store/prefs-store'
import { AuthenticationStore } from '@/store/authentication-store'
import { i18nStore } from '@/store/i18n-store'

Vue.use(Vuex)

const store = new Vuex.Store({
	modules: {
		prefs: PrefsStore,
		auth: AuthenticationStore,
		i18n: i18nStore
	}
})

initializePrefEvents(store)

export default store
