import { EncryptedDatabase } from 'libeds'
import { WalletWrapper } from 'libeds/walletwrapper'
import { BrowserProvider } from 'ethers'
import { sha3_512 as SHA3 } from '@noble/hashes/sha3'

export const EDS = new EncryptedDatabase()

export const EDS_AUTH_BROWSER_WALLET = 0
export const EDS_AUTH_PBKDF = 1
export const EDS_AUTH_UNASSIGNED = 2

async function createWallet ({ username, password, privateKey: LSPK }) {
	let privateKey = null
	const { pbkdf2Async } = await import('@noble/hashes/pbkdf2')

	if (LSPK != null) {
		privateKey = Buffer.from(LSPK, 'base64')
	} else {
		const unameHash = SHA3.create().update(username).digest()
		privateKey = Buffer.from(await pbkdf2Async(SHA3, password, unameHash, {
			c: 500_000,
			dkLen: 32
		}))
	}

	return new WalletWrapper({ privateKey })
}

// NOTE: The params are set here but are parsed in App.vue, this is unfortunate but is necessary to prevent 2-way communication

export async function initializeEDS (authInfo, extraInfo) {
	const {
		authType,
		url
	} = authInfo

	let provider = null
	switch (authType) {
		case EDS_AUTH_BROWSER_WALLET:
			provider = new BrowserProvider(window.ethereum, 'any')

			window.localStorage.setItem('EDS_PARAMS', JSON.stringify([authInfo, extraInfo]))
			break
		case EDS_AUTH_PBKDF:
			provider = await createWallet(extraInfo)

			// Very hacky and unfortunate, have to figure out a better solution later
			// The private key is serialized here but is deserialized in PBKDFWalletWrapper, it should be handled in one place
			window.localStorage.setItem('EDS_PARAMS', JSON.stringify([
				authInfo,
				{
					privateKey: provider.privateKey.toString('base64')
				}
			]))
			break
		default:
			throw new Error('???')
	}

	return EDS.initialize(provider, {
		appID: 'PipedMaterial',
		url
	})
}

window.EDS = EDS
