declare global {
	interface Window {
		themeisleGutenberg?: {
			isCompatible: boolean
			hasPro: boolean
			upgradeLink: string
			should_show_upsell: boolean
			assetsPath: string
			updatePath: string
			optionsPath: object
			mapsAPI: object
			globalDefaults: {
				[key: `themeisle-blocks/${string}`]: object
			}
			themeDefaults: object
			imageSizes: string[]
			isWPVIP: boolean
			canTrack: boolean
			userRoles: {
				[key: string]: {
					name: string
					capabilities: object
				}
			}
			isBlockEditor: boolean
			isLegacyPre59: boolean
			postTypes: {
				page: string
				post: string
				[key: string]: string
			}
			rootUrl: string
			hasModule: {
				blocksConditions: boolean
			}
			blocksIDs: string[]
			isAncestorTypeAvailable: boolean
		}
		otterPro?: {
			isActive: boolean
			isExpired: boolean
			hasWooCommerce: boolean
			hasLearnDash: boolean
			themeMods: {
				listingType: string
				altRow: boolean
				rowColor: string
				headerColor: string
				textColor: string
				borderColor: string
				altRowColor: string
				defaultFields: object
			}
			hasNeveSupport: {
				wooComparison: boolean
			}
			rootUrl: string
		}
		themeisleGutenbergCountdown: {
			i18n: {
				second: string
				seconds: string
				minute: string
				minutes: string
				hour: string
				hours: string
				day: string
				days: string
			}
			timezone: string
		}
	}
}

export default global;
