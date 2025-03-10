/**
 * External dependencies
 */
import classnames from 'classnames';

import { get, isEqual } from 'lodash';

import hash from 'object-hash';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

import api from '@wordpress/api';

import apiFetch from '@wordpress/api-fetch';

import {
	__experimentalBlockVariationPicker as VariationPicker,
	InnerBlocks,
	RichText,
	useBlockProps
} from '@wordpress/block-editor';

import {
	createBlock,
	createBlocksFromInnerBlocksTemplate
} from '@wordpress/blocks';

import {
	select,
	useSelect,
	useDispatch
} from '@wordpress/data';

import {
	Fragment,
	useState,
	useEffect,
	createContext
} from '@wordpress/element';

/**
 * Internal dependencies
 */
import metadata from './block.json';
import {
	blockInit,
	getDefaultValueByField
} from '../../helpers/block-utility.js';
import Inspector from './inspector.js';
import Placeholder from './placeholder.js';
import { useResponsiveAttributes } from '../../helpers/utility-hooks';
import { renderBoxOrNumWithUnit, _cssBlock, _px } from '../../helpers/helper-functions';
const { attributes: defaultAttributes } = metadata;

export const FormContext = createContext({});

const formOptionsMap = {
	email: 'emailTo',
	redirectLink: 'redirectLink',
	emailSubject: 'subject',
	submitMessage: 'submitMessage',
	errorMessage: 'errorMessage',
	fromName: 'fromName',
	cc: 'cc',
	bcc: 'bcc',
	autoresponder: 'autoresponder'
};

/**
 * Form component
 * @param {import('./type').FormProps} props
 * @returns
 */
const Edit = ({
	attributes,
	setAttributes,
	clientId,
	isSelected,
	name
}) => {

	const [ googleCaptchaAPISiteKey, setGoogleCaptchaAPISiteKey ] = useState( '' );
	const [ googleCaptchaAPISecretKey, setGoogleCaptchaAPISecretKey ] = useState( '' );

	const { responsiveGetAttributes } = useResponsiveAttributes( setAttributes );

	const [ loadingState, setLoadingState ] = useState({
		formOptions: 'done',
		formIntegration: 'done',
		listId: 'init',
		captcha: 'init',
		serviceTesting: 'init'
	});

	const [ optionsHaveChanged, setOptionsHaveChanged ] = useState( false );

	const setLoading = l => {
		setOptionsHaveChanged( true );
		setLoadingState( loading => ({ ...loading, ...l }) );
	};

	/**
	 * Get global value if it is the case.
	 * @param {import('../../common').SyncAttrs<import('./type').FormAttrs>} field
	 * @returns
	 */
	const getSyncValue = field =>{
		if ( attributes?.isSynced?.includes( field ) ) {
			return getDefaultValueByField({ name, field, defaultAttributes, attributes });
		}
		return attributes?.[field];
	};

	const [ formOptions, setFormOptions ] = useState({
		provider: undefined,
		redirectLink: undefined,
		fromName: undefined,
		emailTo: undefined,
		subject: undefined,
		email: undefined,
		listId: undefined,
		action: undefined,
		hasCaptcha: undefined,
		submitMessage: undefined,
		errorMessage: undefined,
		apiKey: undefined,
		cc: undefined,
		bcc: undefined,
		autoresponder: undefined
	});

	const {
		insertBlock,
		removeBlock,
		replaceInnerBlocks,
		selectBlock,
		moveBlockToPosition
	} = useDispatch( 'core/block-editor' );

	const setFormOption = option => {
		setFormOptions( options => ({ ...options, ...option }) );
	};

	const [ savedFormOptions, setSavedFormOptions ] = useState( true );

	const [ listIDOptions, setListIDOptions ] = useState([{ label: __( 'None', 'otter-blocks' ), value: '' }]);

	const { createNotice } = useDispatch( 'core/notices' );

	const hasInnerBlocks = useSelect(
		select =>
			0 < select( 'core/block-editor' ).getBlocks( clientId ).length,
		[ clientId ]
	);

	const { blockType, defaultVariation, variations } = useSelect(
		select => {
			const {
				getBlockVariations,
				getBlockType,
				getDefaultBlockVariation
			} = select( 'core/blocks' );

			return {
				blockType: getBlockType( name ),
				defaultVariation: getDefaultBlockVariation( name, 'block' ),
				variations: getBlockVariations( name, 'block' )
			};
		},
		[ name ]
	);

	const { children, hasEmailField, hasProtection } = useSelect( select => {
		const {
			getBlock
		} = select( 'core/block-editor' );
		const children = getBlock( clientId ).innerBlocks;
		return {
			children,
			hasEmailField: children?.some( b => ( 'email' === b?.attributes?.type ) ),
			hasProtection: 0 < children?.filter( ({ name }) => 'themeisle-blocks/form-nonce' === name )?.length
		};
	});

	const { canSaveData } = useSelect( select => {
		const isSavingPost = select( 'core/editor' )?.isSavingPost();
		const isAutosaving = select( 'core/editor' )?.isAutosavingPost();

		return {
			canSaveData: ! isAutosaving && isSavingPost
		};
	});

	const hasEssentialData = attributes.optionName && hasProtection;

	useEffect( () => {
		if ( canSaveData && optionsHaveChanged ) {
			saveFormEmailOptions();
		}
	}, [ canSaveData, optionsHaveChanged ]);

	useEffect( () => {
		const unsubscribe = blockInit( clientId, defaultAttributes );
		return () => unsubscribe( attributes.id );
	}, [ attributes.id ]);

	/**
	 * Create the form identification tag for Otter Options.
	 */
	useEffect( () => {
		if ( attributes.id && select( 'core/edit-widgets' ) ) {
			setAttributes({ optionName: `widget_${ attributes.id.slice( -8 ) }` });
		} else if ( attributes.id ) {
			setAttributes({ optionName: `${ hash({ url: window.location.pathname }) }_${ attributes.id.slice( -8 ) }` });
		}
	}, [ attributes.id ]);

	/**
	 * Make sure that a form nonce field is always present.
	 */
	useEffect( () => {
		if ( children ) {
			const verificationBlocks = children.filter( ({ name }) => 'themeisle-blocks/form-nonce' === name );

			if ( 2 <= verificationBlocks?.length ) {
				verificationBlocks.slice( 1 ).forEach( block => {
					removeBlock( block.clientId, false );
				});
			} else if ( 0 === verificationBlocks?.length && clientId ) {
				const nonceBlock = createBlock( 'themeisle-blocks/form-nonce' );
				if ( nonceBlock ) {
					insertBlock?.( nonceBlock, ( children?.length ) || 0, clientId, false );
				}
			}
		}
	}, [ children ]);

	/**
	 * Get the data from the WP Options for the current form.
	 * @param {Array} forms
	 */
	const extractDataFromWpOptions = forms => {
		return forms?.filter( ({ form }) => form === attributes.optionName ).pop();
	};

	/**
	 * Parse the WP Option data.
	 * @param wpOptions
	 */
	const parseDataFormOptions = wpOptions => {
		setFormOptions({
			emailTo: wpOptions?.email,
			fromName: wpOptions?.fromName,
			redirectLink: wpOptions?.redirectLink,
			subject: wpOptions?.emailSubject,
			cc: wpOptions?.cc,
			bcc: wpOptions?.bcc,
			submitMessage: wpOptions?.submitMessage,
			errorMessage: wpOptions?.errorMessage,
			provider: wpOptions?.integration?.provider,
			apiKey: wpOptions?.integration?.apiKey,
			listId: wpOptions?.integration?.listId,
			action: wpOptions?.integration?.action,
			hasCaptcha: wpOptions?.hasCaptcha,
			autoresponder: wpOptions?.autoresponder
		});
	};

	/**
	 * Load data from the server.
	 */
	useEffect( () => {
		let controller = new AbortController();
		const t = setTimeout( () => {
			setLoading({ formOptions: 'done', formIntegration: 'done' });
		}, 3000 );


		if ( attributes.optionName ) {
			api.loadPromise.then( () => {
				setLoading({ formOptions: 'loading', formIntegration: 'loading' });
				( new api.models.Settings() ).fetch({ signal: controller.signal }).done( res => {
					controller = null;
					const formData = extractDataFromWpOptions( res.themeisle_blocks_form_emails );
					if ( formData ) {
						parseDataFormOptions( formData );
						setSavedFormOptions( formData );
					}
					setLoading({
						formIntegration: 'done',
						formOptions: 'done'
					});
					clearTimeout( t );
				}).catch( () => {
					setLoading({
						formIntegration: 'done',
						formOptions: 'done'
					});
					clearTimeout( t );
				});
			});
		}

		return () => {
			controller?.abort();
			clearTimeout( t );
		};
	}, [ attributes.optionName ]);

	const saveFormEmailOptions = () => {
		setLoading({ formOptions: 'saving' });
		( new api.models.Settings() ).fetch().done( res => {
			const emails = res.themeisle_blocks_form_emails ? res.themeisle_blocks_form_emails : [];
			let isMissing = true;
			let hasUpdated = false;

			emails?.forEach( ({ form }, index ) => {
				if ( form !== attributes.optionName ) {
					return;
				}

				hasUpdated = Object.keys( formOptionsMap ).reduce( ( acc, key ) => {
					return acc || ! isEqual( emails[index][key], formOptions[formOptionsMap[key]]);
				}, false );

				// Update the values
				Object.keys( formOptionsMap ).forEach( key => emails[index][key] = formOptions[formOptionsMap[key]]);

				isMissing = false;
			});

			if ( isMissing ) {
				const data = { form: attributes.optionName };

				Object.keys( formOptionsMap ).forEach( key => {
					data[key] = formOptions[formOptionsMap[key]];
				});

				emails.push( data );
			}

			if ( isMissing || hasUpdated ) {
				const model = new api.models.Settings({
					// eslint-disable-next-line camelcase
					themeisle_blocks_form_emails: emails
				});

				model.save().then( response => {
					const formOptions = extractDataFromWpOptions( response.themeisle_blocks_form_emails );
					if ( formOptions ) {
						parseDataFormOptions( formOptions );
						setSavedFormOptions( formOptions );
						setLoading({ formOptions: 'done' });
						createNotice(
							'info',
							__( 'Form options have been saved.', 'otter-blocks' ),
							{
								isDismissible: true,
								type: 'snackbar'
							}
						);
					} else {
						setLoading({ formOptions: 'error' });
					}
				});
			} else {
				setLoading({ formOptions: 'done' });
			}
		}).catch( () => setLoading({ formOptions: 'error' }) );
	};

	/**
	 * Save integration data.
	 */
	const saveIntegration = () => {
		setLoading({ formIntegration: 'saving' });
		( new api.models.Settings() )?.fetch().done( res => {
			const emails = res.themeisle_blocks_form_emails ? res.themeisle_blocks_form_emails : [];
			let isMissing = true;
			let hasUpdated = false;

			emails?.forEach( ({ form }, index ) => {
				if ( form === attributes.optionName ) {
					if ( ! emails[index]?.integration ) {
						emails[index].integration = {};
					}

					hasUpdated = (
						emails[index].integration?.provider !== formOptions.provider ||
						emails[index].integration?.listId !== formOptions.listId ||
						emails[index].integration?.action !== formOptions.action ||
						emails[index].integration?.apiKey !== formOptions.apiKey
					);
					isMissing = false;
					emails[index].integration.provider = formOptions.provider;
					emails[index].integration.apiKey = formOptions.apiKey;
					emails[index].integration.listId = formOptions.listId;
					emails[index].integration.action = formOptions.action;
				}
			});

			if ( isMissing ) {
				emails.push({
					form: attributes.optionName,
					integration: {
						provider: formOptions.provider,
						apiKey: formOptions.apiKey,
						listId: formOptions.listId,
						action: formOptions.action
					}
				});
			}

			if ( isMissing || hasUpdated ) {
				const model = new api.models.Settings({
					// eslint-disable-next-line camelcase
					themeisle_blocks_form_emails: emails
				});

				model.save().then( response => {
					const formOptions = extractDataFromWpOptions( response.themeisle_blocks_form_emails );
					if ( formOptions ) {
						parseDataFormOptions( formOptions );
						setSavedFormOptions( formOptions );
						setAttributes({
							action: formOptions?.integration?.action
						});
					}
					setLoading({ formIntegration: 'done' });
					if ( hasUpdated ) {
						createNotice(
							'info',
							__( 'Integration details have been saved.', 'otter-blocks' ),
							{
								isDismissible: true,
								type: 'snackbar'
							}
						);
					}
				}).catch( e => {
					console.error( e );
					setLoading({ formIntegration: 'error' });
				});
			} else {
				setLoading({ formIntegration: 'done' });
			}
		}).catch( () => {
			setLoading({ formIntegration: 'error' });
		});
	};

	useEffect( () => {
		let controller = new AbortController();
		let t;
		if ( formOptions.apiKey && formOptions.provider ) {
			t = setTimeout( () => setLoading({ listId: 'timeout' }), 6_000 );
			setLoading({ listId: 'loading' });
			apiFetch({
				path: 'otter/v1/form/editor',
				method: 'POST',
				data: {
					handler: 'listId',
					payload: {
						provider: formOptions.provider,
						apiKey: formOptions.apiKey,
						action: formOptions.action
					}
				},
				signal: controller.signal
			}).then(
				res => {
					controller = null;
					clearTimeout( t );
					if ( res?.success ) {
						const options = res?.list_id?.map( item => {
							return {
								label: item.name,
								value: item.id?.toString()
							};
						}) || [];
						options.splice( 0, 0, { label: __( 'None', 'otter-blocks' ), value: '' });
						setListIDOptions( options );
						setLoading({ listId: 'done' });

						const isCurrentOptionValid = 1 === options.map( ({ value }) => value ).filter( value => value === formOptions.listId ).length;
						if ( formOptions.listId && ! isCurrentOptionValid ) {
							createNotice(
								'error',
								__( 'The current contact list is invalid. Please choose a new contact list.', 'otter-blocks' ),
								{
									isDismissible: true,
									type: 'snackbar'
								}
							);
						}
					} else {
						createNotice(
							'error',
							res?.error,
							{
								isDismissible: true,
								type: 'snackbar',
								id: 'themeisle-form-server-error'
							}
						);

						setLoading({ listId: 'error' });
					}
				}
			).catch( e => {
				console.error( e );
				setLoading({ listId: 'error' });
			});
		}
		return () => {
			controller?.abort();
			clearTimeout( t );
		};
	}, [ formOptions.apiKey, formOptions.provider ]);


	const sendTestEmail = () => {
		apiFetch({
			path: 'otter/v1/form/editor',
			method: 'POST',
			data: {
				handler: 'testEmail',
				payload: {
					provider: 'default',
					to: formOptions?.emailTo,
					site: window.location.href
				}
			}
		}).then( res => {
			if ( res?.success ) {
				createNotice(
					'info',
					__( 'The test email has been send. Check your emails for confirmation.', 'otter-blocks' ),
					{
						isDismissible: true,
						type: 'snackbar'
					}
				);
			} else {
				createNotice(
					'error',
					__( 'An error has occurred: ', 'otter-blocks' ) + ( res?.error || __( 'unknown', 'otter-blocks' ) ),
					{
						isDismissible: true,
						type: 'snackbar'
					}
				);
			}
		}).catch( error => {
			console.error( error );
			createNotice(
				'error',
				error?.message,
				{
					isDismissible: true,
					type: 'snackbar'
				}
			);
		});
	};

	const testService = () => {
		setLoading({
			serviceTesting: 'loading'
		});
		apiFetch({
			path: 'otter/v1/form/editor',
			method: 'POST',
			data: {
				handler: 'testEmail',
				payload: {
					formOption: attributes.optionName
				}
			}
		}).then( res => {
			if ( res?.success ) {
				createNotice(
					'info',
					__( 'A test email has been registered to your contact list. Check your provider for confirmation.', 'otter-blocks' ),
					{
						isDismissible: true,
						type: 'snackbar'
					}
				);
				setLoading({
					serviceTesting: 'done'
				});
			} else {
				createNotice(
					'error',
					__( 'An error has occurred: ', 'otter-blocks' ) + ( res?.error || __( 'unknown', 'otter-blocks' ) + __( '. Check your provider for confirmation.', 'otter-blocks' ) ),
					{
						isDismissible: true,
						type: 'snackbar'
					}
				);
				setLoading({
					serviceTesting: 'error'
				});
			}

		}).catch( error => {
			console.error( error );
			createNotice(
				'error',
				error?.message,
				{
					isDismissible: true,
					type: 'snackbar'
				}
			);
			setLoading({
				testService: 'error'
			});
		});
	};

	/**
	 * Save the captcha option in settings.
	 */
	useEffect( () => {
		let controller = new AbortController();
		if ( attributes.hasCaptcha !== undefined && attributes.optionName ) {
			try {
				( new api.models.Settings() )?.current?.fetch({ signal: controller.signal }).done( res => {
					controller = null;

					const emails = res.themeisle_blocks_form_emails ? res.themeisle_blocks_form_emails : [];
					let isMissing = true;
					let hasChanged = false;

					emails?.forEach( ({ form }, index ) => {
						if ( form === attributes.optionName ) {
							if ( emails[index].hasCaptcha !== attributes.hasCaptcha ) {
								hasChanged = true;
							}
							emails[index].hasCaptcha = attributes.hasCaptcha;
							isMissing = false;
						}
					});

					if ( isMissing ) {
						emails.push({
							form: attributes.optionName,
							hasCaptcha: attributes.hasCaptcha
						});
					}

					if ( isMissing || hasChanged ) {
						const model = new api.models.Settings({
							// eslint-disable-next-line camelcase
							themeisle_blocks_form_emails: emails
						});

						model.save();

						createNotice(
							'info',
							__( 'Form preferences have been saved.', 'otter-blocks' ),
							{
								isDismissible: true,
								type: 'snackbar'
							}
						);
					}
				});
			} catch ( e ) {
				console.warn( e.message );
			}
		}
		return () => controller?.abort();
	}, [ attributes.hasCaptcha, attributes.optionName ]);

	/**
	 * Check if the reCaptcha API Keys are set.
	 */
	useEffect( () => {
		let controller = new AbortController();
		const getCaptchaAPIData = () => {
			setLoading({ captcha: 'loading' });
			try {
				( new api.models.Settings() )?.fetch({ signal: controller.signal }).then( response => {
					controller = null;

					if ( '' !== response.themeisle_google_captcha_api_site_key && '' !== response.themeisle_google_captcha_api_secret_key ) {
						setLoading({ captcha: 'done' });
					} else {
						setLoading({ captcha: 'missing' });
						setGoogleCaptchaAPISiteKey( response.themeisle_google_captcha_api_site_key );
						setGoogleCaptchaAPISecretKey( response.themeisle_google_captcha_api_secret_key );
					}
				}).catch( e => {
					console.error( e );
					setLoading({ captcha: 'error' });
				});
			} catch ( e ) {
				console.warn( e.message );
				setLoading({ captcha: 'error' });
			}
		};

		if ( attributes.hasCaptcha && 'init' === loadingState?.captcha ) {
			getCaptchaAPIData();
		}

		return () => controller?.abort();
	}, [ loadingState.captcha, attributes.hasCaptcha ]);

	/**
	 * Save API Keys in the Otter options.
	 */
	const saveCaptchaAPIKey = () => {
		setLoading({ captcha: 'loading' });
		try {
			const model = new api.models.Settings({
				// eslint-disable-next-line camelcase
				themeisle_google_captcha_api_site_key: googleCaptchaAPISiteKey,
				// eslint-disable-next-line camelcase
				themeisle_google_captcha_api_secret_key: googleCaptchaAPISecretKey
			});

			model?.save?.()?.then( response => {

				if ( '' !== response.themeisle_google_captcha_api_site_key && '' !== response.themeisle_google_captcha_api_secret_key ) {
					setLoading({ captcha: 'done' });
				} else {
					setLoading({ captcha: 'missing' });
				}

				setGoogleCaptchaAPISecretKey( '' );
				setGoogleCaptchaAPISiteKey( '' );
				createNotice(
					'info',
					__( 'Google reCaptcha API Keys have been saved.', 'otter-blocks' ),
					{
						isDismissible: true,
						type: 'snackbar'
					}
				).catch( e => {
					console.error( e );
					setLoading({ captcha: 'error' });
				});
			})?.catch( e => {
				console.error( e );
				setLoading({ captcha: 'error' });
			});
		} catch ( e ) {
			console.warn( e.message );
			setLoading({ captcha: 'error' });
		}
	};

	const inlineStyles = {
		'--message-font-size': getSyncValue( 'messageFontSize' ),
		'--input-font-size': getSyncValue( 'inputFontSize' ),
		'--help-font-size': getSyncValue( 'helpFontSize' ),
		'--input-color': getSyncValue( 'inputColor' ),
		'--padding': renderBoxOrNumWithUnit(
			responsiveGetAttributes([
				getSyncValue( 'inputPadding' ),
				getSyncValue( 'inputPaddingTablet' ),
				getSyncValue( 'inputPaddingMobile' )
			]), 'px' ),
		'--border-radius': renderBoxOrNumWithUnit( getSyncValue( 'inputBorderRadius' ), 'px' ),
		'--border-width': renderBoxOrNumWithUnit( getSyncValue( 'inputBorderWidth' ), 'px' ),
		'--border-color': getSyncValue( 'inputBorderColor' ),
		'--label-color': getSyncValue( 'labelColor' ),
		'--input-width': getSyncValue( 'inputWidth' ) !== undefined && ( getSyncValue( 'inputWidth' ) + '%' ),
		'--submit-color': getSyncValue( 'submitColor' ),
		'--submit-bg-color': getSyncValue( 'submitBackgroundColor' ),
		'--submit-color-hover': getSyncValue( 'submitColorHover' ),
		'--submit-bg-color-hover': getSyncValue( 'submitBackgroundColorHover' ),
		'--required-color': getSyncValue( 'inputRequiredColor' ),
		'--input-gap': getSyncValue( 'inputGap' ) !== undefined && ( getSyncValue( 'inputGap' ) + 'px' ),
		'--inputs-gap': getSyncValue( 'inputsGap' ) !== undefined && ( getSyncValue( 'inputsGap' ) + 'px' ),
		'--label-font-size': _px( getSyncValue( 'labelFontSize' ) ),
		'--submit-font-size': getSyncValue( 'submitFontSize' ),
		'--help-label-color': getSyncValue( 'helpLabelColor' ),
		'--input-bg-color': getSyncValue( 'inputBackgroundColor' ),
		'--btn-pad': renderBoxOrNumWithUnit(
			responsiveGetAttributes([
				getSyncValue( 'buttonPadding' ),
				getSyncValue( 'buttonPaddingTablet' ),
				getSyncValue( 'buttonPaddingMobile' )
			]), 'px' )
	};

	const blockProps = useBlockProps({
		id: attributes.id,
		style: inlineStyles
	});

	const inputFieldActions = {
		select: ( blockId ) => {
			if ( 0 < children?.length ) {
				const block = children.find( block => block.clientId === blockId );
				selectBlock( block.clientId );
			}
		},
		move: ( blockId, position ) => {
			const blockClientId = children.find( block => block.clientId === blockId )?.clientId;
			if ( blockClientId ) {
				moveBlockToPosition( blockClientId, clientId, clientId, position );
			}
		},
		delete: ( blockId ) => {
			if ( 0 < children?.length ) {
				const block = children.find( block => block.clientId === blockId );
				removeBlock( block.clientId, false );
			}
		},
		add: ( blockName ) => {
			const itemBlock = createBlock( blockName );
			insertBlock( itemBlock, ( children?.length ) || 0, clientId, false );
		}
	};

	return (
		<Fragment>
			<FormContext.Provider
				value={{
					savedFormOptions,
					listIDOptions,
					setListIDOptions,
					saveFormEmailOptions,
					formOptions,
					setFormOption,
					saveIntegration,
					sendTestEmail,
					loadingState,
					testService,
					hasEmailField,
					children,
					inputFieldActions,
					hasInnerBlocks
				}}
			>
				<Inspector
					attributes={ attributes }
					setAttributes={ setAttributes }
				/>

				<div { ...blockProps }>
					{
						( hasInnerBlocks ) ? (
							<form
								className="otter-form__container"
								onSubmit={ () => false }
							>
								<style>
									{
										`#block-${ clientId } .wp-block-button .wp-block-button__link:not(:hover) ` + _cssBlock([
											[ 'color', getSyncValue( 'submitColor' ) ],
											[ 'background-color', getSyncValue( 'submitBackgroundColor' )  ]
										])
									}
									{
										`#block-${ clientId } .wp-block-button .wp-block-button__link:hover ` + _cssBlock([
											[ 'color', getSyncValue( 'submitColorHover' ) ],
											[ 'background-color', getSyncValue( 'submitBackgroundColorHover' ) ]
										])
									}
								</style>
								<InnerBlocks
								/>

								{
									attributes.hasCaptcha && 'done' !== loadingState?.captcha && (
										<Placeholder
											className="otter-form-captcha"
											loadingState={ loadingState }
											saveAPIKey={ saveCaptchaAPIKey }
											siteKey={ googleCaptchaAPISiteKey }
											secretKey={ googleCaptchaAPISecretKey }
											setSiteKey={ setGoogleCaptchaAPISiteKey }
											setSecretKey={ setGoogleCaptchaAPISecretKey }
										/>
									)
								}

								{ 'submit-subscribe' === attributes.action && (
									<div className="otter-form-consent">
										<input id="o-consent" name="o-consent" type="checkbox" />
										<label htmlFor="o-consent">
											{ __( 'I have read and agreed the privacy statement.', 'otter-blocks' ) }
										</label>
									</div>
								) }

								<div
									className={
										classnames(
											'wp-block-button has-submit-msg',
											{ 'left': 'left' === attributes.submitStyle },
											{ 'right': 'right' === attributes.submitStyle },
											{ 'full': 'full' === attributes.submitStyle },
											{ 'o-full-tablet': 'full' === attributes.submitStyleTablet },
											{ 'o-right-tablet': 'right' === attributes.submitStyleTablet },
											{ 'o-left-tablet': 'left' === attributes.submitStyleTablet },
											{ 'o-full-mobile': 'full' === attributes.submitStyleMobile },
											{ 'o-right-mobile': 'right' === attributes.submitStyleMobile },
											{ 'o-left-mobile': 'left' === attributes.submitStyleMobile },
											{ 'o-center': 'center' === attributes.submitStyle },
											{ 'o-center-tablet': 'center' === attributes.submitStyleTablet },
											{ 'o-center-mobile': 'center' === attributes.submitStyleMobile }
										)}
								>
									<RichText
										className='wp-block-button__link'
										placeholder={ __( 'Submit', 'otter-blocks' ) }
										value={ attributes.submitLabel }
										onChange={ submitLabel => setAttributes({ submitLabel }) }
										tagName="button"
										type='submit'
										onClick={ e => e.preventDefault() }
									/>

									{ isSelected && (
										<Fragment>
											<div>
												<div className='o-form-server-response o-success' style={{ color: attributes.submitMessageColor }}>
													{ formOptions.submitMessage || __( 'Success', 'otter-blocks' ) }
												</div>
												<div className='o-form-server-response o-error' style={{ color: attributes.submitMessageErrorColor, margin: '0px' }}>
													{ __( 'Error. Please try again.', 'otter-blocks' ) }
												</div>
											</div>
											{
												! hasEssentialData && attributes.id && (
													<Fragment>
														<p>{__( 'Some data is missing!', 'otter-blocks' )}</p>
														{
															attributes.optionName === undefined && (
																<p>{__( 'Bad initialization. Please create another Form!', 'otter-blocks' )}</p>
															)
														}
														{
															false === hasProtection && (
																<p>{__( 'CSRF protection is missing. Please create another Form!', 'otter-blocks' )}</p>
															)
														}
													</Fragment>
												)
											}
										</Fragment>
									) }
								</div>
							</form>
						) : (
							<VariationPicker
								icon={ get( blockType, [ 'icon', 'src' ]) }
								label={ get( blockType, [ 'title' ]) }
								variations={ variations }
								onSelect={ ( nextVariation = defaultVariation ) => {
									if ( nextVariation ) {
										replaceInnerBlocks(
											clientId,
											createBlocksFromInnerBlocksTemplate(
												nextVariation.innerBlocks
											),
											true
										);
									}
									selectBlock( clientId );
								} }
								allowSkip
							/>
						)
					}
				</div>
			</FormContext.Provider>
		</Fragment>
	);
};

export default Edit;
