/** @jsx jsx */

/**
 * WordPress dependencies.
 */
import { InnerBlocks } from '@wordpress/block-editor';

import {
	Fragment,
	useEffect
} from '@wordpress/element';

import {
	css,
	jsx
} from '@emotion/react';

/**
 * Internal dependencies
 */
import { blockInit } from '../../helpers/block-utility.js';
import defaultAttributes from './attributes.js';
import Inspector from './inspector.js';

const Edit = ({
	attributes,
	setAttributes,
	clientId,
	className
}) => {
	useEffect( () => {
		const unsubscribe = blockInit( clientId, defaultAttributes );
		return () => unsubscribe( attributes.id );
	}, [ attributes.id ]);

	return (
		<Fragment>
			<Inspector
				attributes={ attributes }
				setAttributes={ setAttributes }
			/>

			<div
				id={ attributes.id }
				className={ className }
				css={
					css`
						.block-editor-block-list__block {
							justify-content: ${ attributes.verticalAlign || 'unset' } !important;
						}
					`
				}
			>
				<InnerBlocks
					allowedBlocks={ [ 'themeisle-blocks/icon-list-item' ] }
					__experimentalMoverDirection="vertical"
					orientation="vertical"
					template={ [ [ 'themeisle-blocks/icon-list-item' ] ] }
					renderAppender={ InnerBlocks.DefaultAppender }
				/>
			</div>
		</Fragment>
	);
};

export default Edit;
