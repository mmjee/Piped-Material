import Vue from 'vue'
import VueI18n from 'vue-i18n'
import TimeAgo from 'javascript-time-ago'
import * as LocaleMatcher from '@formatjs/intl-localematcher'

import { EDS } from '@/plugins/eds'
import store from '@/store'
import ENTranslations from '@/translations/en.json'
import ENTimeAgo from 'javascript-time-ago/locale/en.json'

Vue.use(VueI18n)
TimeAgo.addLocale(ENTimeAgo)

const messages = {
	en: ENTranslations
}

const TIME_AGO_LOADED = {
	en: true
}

// ls -f | grep -E '.json$' | sed -E 's/.json$//g'
const TA_SUPPORTED_LANGUAGES = `af
am
ar-AE
ar
as
ast
az
be
bg
bgc
bn
br
brx
bs-Cyrl
bs
ca
ccp
ce
ceb
chr
cs
cv
cy
da
de
dsb
dz
ee
el
en-001
en-150
en-AG
en-AI
en-AT
en-AU
en-BB
en-BE
en-BM
en-BS
en-BW
en-BZ
en-CA
en-CC
en-CH
en-CK
en-CM
en-CX
en-CY
en-DE
en-DG
en-DK
en-DM
en-ER
en-FI
en-FJ
en-FK
en-FM
en-GB
en-GD
en-GG
en-GH
en-GI
en-GM
en-GY
en-HK
en-IE
en-IL
en-IM
en-IN
en-IO
en-JE
en-JM
en-KE
en-KI
en-KN
en-KY
en-LC
en-LR
en-LS
en-MG
en-MO
en-MS
en-MT
en-MU
en-MV
en-MW
en-MY
en-NA
en-NF
en-NG
en-NL
en-NR
en-NU
en-NZ
en-PG
en-PK
en-PN
en-PW
en-RW
en-SB
en-SC
en-SD
en-SE
en-SG
en-SH
en-SI
en-SL
en-SS
en-SX
en-SZ
en-TC
en-TK
en-TO
en-TT
en-TV
en-TZ
en-UG
en-VC
en-VG
en-VU
en-WS
en-ZA
en-ZM
en-ZW
en
eo
es-419
es-AR
es-BO
es-BR
es-BZ
es-CL
es-CO
es-CR
es-CU
es-DO
es-EC
es-GT
es-HN
es-MX
es-NI
es-PA
es-PE
es-PR
es-PY
es-SV
es-US
es-UY
es-VE
es
et
eu
fa
ff-Adlm
fi
fil
fo
fr-CA
fr
fur
fy
ga
gd
gl
gu
ha
he
hi-Latn
hi
hr
hsb
hu
hy
ia
id
ig
is
it
ja
jgo
jv
ka
kea
kgp
kk
kl
km
kn
ko
kok
ks
ksh
ku
ky
lb
lkt
lo
lt
lv
mai
mi
mk
ml
mn
mni
mr
ms
mt
my
mzn
nb
ne
nl
nn
no
or
pa
pcm
pl
ps-PK
ps
pt-AO
pt-CH
pt-CV
pt-GQ
pt-GW
pt-LU
pt-MO
pt-MZ
pt-PT
pt-ST
pt-TL
pt
qu
raj
rm
ro
ru
sah
sc
sd
se-FI
se
si
sk
sl
so
sq
sr-Cyrl-BA
sr-Latn-BA
sr-Latn
sr
su
sv
sw
ta
te
tg
th
ti
tk
to
tr
tt
ug
uk
ur-IN
ur
uz-Cyrl
uz
vi
wae
wo
xh
yi
yo-BJ
yo
yrl
yue-Hans
yue
zh-Hans-HK
zh-Hans-MO
zh-Hans-SG
zh-Hant-HK
zh-Hant-MO
zh-Hant
zh
zu`.split('\n')

const COUNTRY_I18N_SUPPORTED_LANGUAGES = `af
am
ar
az
be
bg
bn
bs
ca
cs
da
cy
de
dv
el
en
es
et
eu
fa
fi
fr
gl
ha
he
hi
hr
hu
hy
id
is
it
ja
ka
kk
km
ko
ku
ky
lt
lv
mk
ml
mn
ms
nb
nl
nn
no
pl
ps
pt
ro
ru
sd
sk
sl
so
sq
sr
sv
sw
ta
tg
th
tr
tt
ug
uk
ur
uz
vi
zh`.split('\n')

export const SUPPORTED_LANGUAGES = [
	'az',
	'en',
	'fr',
	'de',
	'el',
	'es',
	'id',
	'it',
	'zh-Hans',
	'zh-Hant',
	'cs',
	'ja',
	'ko',
	'ru',
	'lt',
	'ml',
	'nb-NO',
	'tr',
	'pt',
	'pt-BR',
	'bn',
	'bn-IN',
	'ar',
	'ckb',
	'hr',
	'nl',
	'sr',
	'bs',
	'uk',
	'ro',
	'pl'
]

export const i18n = new VueI18n({
	locale: 'en', // set default locale
	fallbackLocale: 'en',
	messages
})

export const DEPRECATED_LANGUAGES_MAP = new Map([
	['bn-Beng', 'bn-IN']
])

export const COUNTRY_I18N_EXCEPTIONS = {
	ckb: 'ku'
}

export const TIME_AGO_EXCEPTIONS = {}

// Similar switches for RTL can be found in the i18n store
async function syncStylesPerLanguage (locale) {
	document.documentElement.setAttribute('lang', locale.toString())
	switch (locale.script) {
		// All the Inter-based languages
		case 'Latn':
		case 'Cyrl':
		case 'Grek':
			// Don't need to import fonts because Inter supports Latin and Cyrillic and is always loaded
			document.body.classList.remove(...document.body.classList)
			document.body.classList.add('default-font')
			break
		// Bengali script
		case 'Beng':
			await import('@fontsource-variable/baloo-da-2/index.css')
			document.body.classList.remove(...document.body.classList)
			document.body.classList.add('bengali')
			break
		// Malayalam script
		case 'Mlym':
			await import('@fontsource-variable/baloo-chettan-2/index.css')
			document.body.classList.remove(...document.body.classList)
			document.body.classList.add('malayalam')
			break
		// Other languages
		// NOTE: if you are a native speaker & want to see a different font, just email me or join the channel
		case 'Arab':
			await import('@fontsource-variable/noto-naskh-arabic/index.css')
			document.body.classList.remove(...document.body.classList)
			document.body.classList.add('arabic-script')
			break
		case 'Hant':
			await import('@mojee/noto-sans-cjk-webfont/tc.css')
			document.body.classList.remove(...document.body.classList)
			document.body.classList.add('traditional-chinese')
			break
		case 'Hans':
			await import('@mojee/noto-sans-cjk-webfont/sc.css')
			document.body.classList.remove(...document.body.classList)
			document.body.classList.add('simplified-chinese')
			break
		case 'Jpan':
			await import('@mojee/noto-sans-cjk-webfont/jp.css')
			document.body.classList.remove(...document.body.classList)
			document.body.classList.add('japanese')
			break
		case 'Kore':
			await import('@mojee/noto-sans-cjk-webfont/kr.css')
			document.body.classList.remove(...document.body.classList)
			document.body.classList.add('korean')
			break
		default:
			throw new Error('Invalid language')
	}
}

export async function loadLocale (locale) {
	const lo = LocaleMatcher.match(locale, SUPPORTED_LANGUAGES, 'en')
	if (!i18n.availableLocales.includes(lo)) {
		// load locale messages with dynamic import
		const messages = await import(/* webpackChunkName: "translations-[request]" */ `@/translations/${lo}.json`)

		// set locale and locale message
		i18n.setLocaleMessage(lo, messages.default)
	}
	i18n.locale = lo
	return Vue.nextTick()
}

async function loadFormatting (locale, parsed) {
	const tal = TIME_AGO_EXCEPTIONS[locale] ?? locale
	const proposed = LocaleMatcher.match(tal, TA_SUPPORTED_LANGUAGES, 'en')
	if (!TIME_AGO_LOADED[proposed]) {
		const data = await import(/* webpackChunkName: "timeago-[request]" */ `javascript-time-ago/locale/${proposed}.json`)
		TimeAgo.addLocale(data)
		TIME_AGO_LOADED[proposed] = true
	}
	const timeAgo = new TimeAgo(proposed, {
		polyfill: false
	})

	store.commit('i18n/updateState', {
		locale,
		parsed,
		timeAgo
	})
}

export async function loadCountries (locale) {
	locale = COUNTRY_I18N_EXCEPTIONS[locale] ?? locale
	locale = LocaleMatcher.match(locale, COUNTRY_I18N_SUPPORTED_LANGUAGES, 'en')
	return Promise.all([
		import('i18n-iso-countries'),
		import(/* webpackChunkName: "countries-[request]" */ `i18n-iso-countries/langs/${locale}.json`)
	])
}

export async function changeLocale (lang) {
	if (DEPRECATED_LANGUAGES_MAP.has(lang)) {
		lang = DEPRECATED_LANGUAGES_MAP.get(lang)
	}

	const parsed = new Intl.Locale(lang).maximize()
	await Promise.all([
		loadLocale(lang),
		syncStylesPerLanguage(parsed),
		loadFormatting(lang, parsed)
	])
	await EDS.setKey('locale', lang)
}

export async function initializeLocalLocale () {
	let lang = await EDS.getKey('locale')
	if (lang == null) {
		lang = LocaleMatcher.match(navigator.languages, SUPPORTED_LANGUAGES, 'en')
	}
	return changeLocale(lang)
}
