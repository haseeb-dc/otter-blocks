/**
 * WordPress dependencies.
 */
import { __ } from '@wordpress/i18n';

import { Popover } from '@wordpress/components';

import {
	useEffect,
	useState
} from '@wordpress/element';

import {
	applyFormat,
	toggleFormat
} from '@wordpress/rich-text';

/**
 * Internal dependencies.
 */
import Fields from './fields.js';

const name = 'themeisle-blocks/dynamic-value';

const InlineControls = ({
	value,
	activeAttributes,
	contentRef,
	onChange
}) => {
	const [ attributes, setAttributes ] = useState({ ...activeAttributes });

	useEffect( () => {
		setAttributes({ ...activeAttributes });
	}, [ activeAttributes ]);

	const changeAttributes = obj => {
		let attrs = { ...attributes };

		Object.keys( obj ).forEach( o => {
			attrs[ o ] = obj[ o ];
		});

		attrs = Object.fromEntries( Object.entries( attrs ).filter( ([ _, v ]) => ( null !== v && '' !== v ) ) );

		setAttributes({ ...attrs });
	};

	const changeType = type => {
		setAttributes({ type });
	};

	const anchorRect = contentRef.current.getBoundingClientRect();

	return (
		<Popover
			position="bottom-center"
			noArrow={ false }
			anchorRect={ anchorRect }
			focusOnMount={ false }
			className="o-dynamic-popover"
		>
			<Fields
				activeAttributes={ activeAttributes }
				attributes={ attributes }
				changeAttributes={ changeAttributes }
				changeType={ changeType }
				isInline={ true }
				onChange={ () => {
					const attrs = Object.fromEntries( Object.entries( attributes ).filter( ([ _, v ]) => ( null !== v && '' !== v ) ) );

					onChange(
						applyFormat( value, {
							type: name,
							attributes: attrs
						})
					);
				} }
				onRemove={ () => {
					const attrs = Object.fromEntries( Object.entries( attributes ).filter( ([ _, v ]) => ( null !== v && '' !== v ) ) );

					onChange(
						toggleFormat( value, {
							type: name,
							attributes: attrs
						})
					);
				} }
			/>
		</Popover>
	);
};

export default InlineControls;
