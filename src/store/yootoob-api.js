import _axios from 'axios'
import { pack as msgpack, unpack as msgunpack } from 'msgpackr'

const exemptedRequestTypes = new Set(['get', 'head'])
const axios = _axios.create({
	responseType: 'arraybuffer',
	baseURL: process.env.VUE_APP_YOOTOOB_URL ?? 'http://localhost:8000',
	transformRequest: [
		function (data, headers) {
			if (exemptedRequestTypes.has(this.method.toLowerCase())) {
				return
			}
			headers['Content-Type'] = 'application/msgpack'
			return msgpack(data)
		}
	],
	transformResponse: [(data) => msgunpack(data)],
	headers: {
		Accept: 'application/msgpack'
	}
})

export function getVideoData (videoID) {
	return axios({
		method: 'POST',
		url: '/api/v1/get/video/streams',
		data: {
			videoID
		}
	})
}
