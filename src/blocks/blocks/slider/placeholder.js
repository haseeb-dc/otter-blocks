/**
 * WordPress dependencies
 */
import { debounce } from 'lodash';

import { useCallback } from '@wordpress/element';

import { MediaPlaceholder } from '@wordpress/block-editor';

const BlockPlaceholder = ({
	labels,
	icon,
	isAppender = false,
	value = {},
	onSelectImages
}) => {
	const selectImages = useCallback( () => debounce( onSelectImages, 250 ), []);

	return (
		<MediaPlaceholder
			labels={ labels }
			icon={ icon }
			accept="image/*"
			allowedTypes={ [ 'image' ] }
			isAppender={ isAppender }
			className="wp-block-themeisle-blocks-slider-uploader"
			value={ value }
			onSelect={ selectImages }
			multiple
		/>
	);
};

export default BlockPlaceholder;
