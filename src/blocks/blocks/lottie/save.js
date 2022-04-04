/**
 * Wordpress dependencies
 */
import { useBlockProps } from '@wordpress/block-editor';

const Save = ({
	attributes
}) => {
	const blockProps = useBlockProps.save({
		id: attributes.id,
		src: attributes.file ? attributes.file.url : '',
		width: attributes.widthUnit === undefined ? attributes.width : `${ attributes.width }${ attributes.widthUnit }`
	});

	if ( 'scroll' === attributes.trigger ) {
		return (
			<lottie-player
				trigger={ attributes.trigger }
				{ ...blockProps }
			>
			</lottie-player>
		);
	}

	return (
		<lottie-player
			autoplay
			loop
			count={ attributes.direction ? attributes.count * -1 : attributes.count }
			speed={ attributes.speed }
			direction={ attributes.direction ? -1 : 1 }
			trigger={ attributes.trigger }
			data-loop={ attributes.loop }
			mode="normal"
			{ ...( attributes.ariaLabel && { 'aria-label': attributes.ariaLabel }) }
			{ ...blockProps }
		>
		</lottie-player>
	);
};

export default Save;
