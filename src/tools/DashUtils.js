// Based of https://github.com/GilgusMaximus/yt-dash-manifest-generator/blob/master/src/DashGenerator.js
import { json2xml } from 'xml-js'

export function generateDashFileFromFormats (VideoFormats, VideoLength) {
	const generatedJSON = generateJSONFromData(VideoFormats, VideoLength)
	return json2xml(generatedJSON)
}

function generateJSONFromData (VideoFormatArray, VideoLength) {
	const convertJSON = {
		declaration: {
			attributes: {
				version: '1.0',
				encoding: 'utf-8'
			}
		},
		elements: [
			{
				type: 'element',
				name: 'MPD',
				attributes: {
					xmlns: 'urn:mpeg:dash:schema:mpd:2011',
					profiles: 'urn:mpeg:dash:profile:full:2011',
					minBufferTime: 'PT1.5S',
					type: 'static',
					mediaPresentationDuration: `PT${VideoLength}S`
				},
				elements: [
					{
						type: 'element',
						name: 'Period',
						elements: generateAdaptationSet(VideoFormatArray)
					}
				]
			}
		]
	}
	return convertJSON
}

function generateAdaptationSet (VideoFormatArray) {
	const adaptationSets = []

	const mimeAudioObjs = []

	VideoFormatArray.forEach(videoFormat => {
		// the dual formats should not be used
		if (
			(videoFormat.mimeType.includes('video') && !videoFormat.videoOnly) ||
            videoFormat.mimeType.includes('application')
		) {
			return
		}

		const audioTrackId = videoFormat.audioTrackId
		const mimeType = videoFormat.mimeType

		for (let i = 0; i < mimeAudioObjs.length; i++) {
			const mimeAudioObj = mimeAudioObjs[i]

			if (mimeAudioObj.audioTrackId === audioTrackId && mimeAudioObj.mimeType === mimeType) {
				mimeAudioObj.videoFormats.push(videoFormat)
				return
			}
		}

		mimeAudioObjs.push({
			audioTrackId,
			mimeType,
			videoFormats: [videoFormat]
		})
	})

	mimeAudioObjs.forEach(mimeAudioObj => {
		const adapSet = {
			type: 'element',
			name: 'AdaptationSet',
			attributes: {
				id: mimeAudioObj.audioTrackId,
				lang: mimeAudioObj.audioTrackId?.substr(0, 2),
				mimeType: mimeAudioObj.mimeType,
				startWithSAP: '1',
				subsegmentAlignment: 'true'
			},
			elements: []
		}

		let isVideoFormat = false

		if (mimeAudioObj.mimeType.includes('video')) {
			isVideoFormat = true
		}

		if (isVideoFormat) {
			adapSet.attributes.scanType = 'progressive'
		}

		for (let i = 0; i < mimeAudioObj.videoFormats.length; i++) {
			const videoFormat = mimeAudioObj.videoFormats[i]
			if (isVideoFormat) {
				adapSet.elements.push(generateRepresentationVideo(videoFormat))
			} else {
				adapSet.elements.push(generateRepresentationAudio(videoFormat))
			}
		}

		adaptationSets.push(adapSet)
	})
	return adaptationSets
}

function generateRepresentationAudio (Format) {
	const representation = {
		type: 'element',
		name: 'Representation',
		attributes: {
			id: Format.itag,
			codecs: Format.codec,
			bandwidth: Format.bitrate
		},
		elements: [
			{
				type: 'element',
				name: 'AudioChannelConfiguration',
				attributes: {
					schemeIdUri: 'urn:mpeg:dash:23003:3:audio_channel_configuration:2011',
					value: '2'
				}
			},
			{
				type: 'element',
				name: 'BaseURL',
				elements: [
					{
						type: 'text',
						text: Format.url
					}
				]
			},
			{
				type: 'element',
				name: 'SegmentBase',
				attributes: {
					indexRange: `${Format.indexStart}-${Format.indexEnd}`
				},
				elements: [
					{
						type: 'element',
						name: 'Initialization',
						attributes: {
							range: `${Format.initStart}-${Format.initEnd}`
						}
					}
				]
			}
		]
	}
	return representation
}

function generateRepresentationVideo (Format) {
	const representation = {
		type: 'element',
		name: 'Representation',
		attributes: {
			id: Format.itag,
			codecs: Format.codec,
			bandwidth: Format.bitrate,
			width: Format.width,
			height: Format.height,
			maxPlayoutRate: '1',
			frameRate: Format.fps
		},
		elements: [
			{
				type: 'element',
				name: 'BaseURL',
				elements: [
					{
						type: 'text',
						text: Format.url
					}
				]
			},
			{
				type: 'element',
				name: 'SegmentBase',
				attributes: {
					indexRange: `${Format.indexStart}-${Format.indexEnd}`
				},
				elements: [
					{
						type: 'element',
						name: 'Initialization',
						attributes: {
							range: `${Format.initStart}-${Format.initEnd}`
						}
					}
				]
			}
		]
	}
	return representation
}
