/**
 * External dependencies
 */
import { basename, join } from 'path';
import { writeFileSync } from 'fs';
import { average, median, standardDeviation, quantileRank } from 'simple-statistics';
const { PuppeteerScreenRecorder } = require( 'puppeteer-screen-recorder' );

/**
 * WordPress dependencies
 */
import {
	createNewPost,
	saveDraft,
	insertBlock
} from '@wordpress/e2e-test-utils';

/**
 * Internal dependencies
 */
import {
	readFile,
	deleteFile,
	getTypingEventDurations
} from '../utils';

import { mapValues } from 'lodash';

jest.setTimeout( 1000000 );

let screenRecorder;

describe( 'Post Editor Performance', () => {
	const results = {
		serverResponse: [],
		firstPaint: [],
		domContentLoaded: [],
		loaded: [],
		firstContentfulPaint: [],
		firstBlock: [],
		type: [],
		focus: [],
		listViewOpen: [],
		inserterOpen: [],
		inserterHover: [],
		inserterSearch: []
	};
	const traceFile = __dirname + '/trace.json';
	let traceResults;

	beforeAll( async() => {
		const screenRecorderOptions = {
			followNewTab: true,
			fps: 25
		};

		const savePath = './artifact/tests/typing-test.mp4';
		screenRecorder = new PuppeteerScreenRecorder( page, screenRecorderOptions );
		await screenRecorder.start( savePath );

		const html = readFile(
			join( __dirname, '..', '/assets/large-otter-post.html' )
		);

		await createNewPost();
		await page.evaluate( ( _html ) => {
			const { parse } = window.wp.blocks;
			const { dispatch } = window.wp.data;
			const blocks = parse( _html );

			blocks.forEach( ( block ) => {
				if ( 'core/image' === block.name ) {
					delete block.attributes.id;
					delete block.attributes.url;
				}
			});

			dispatch( 'core/block-editor' ).resetBlocks( blocks );
		}, html );

		await saveDraft();
	});

	afterAll( async() => {
		await screenRecorder.stop();

		const summary = Object.entries( results ).filter( ([ _, value ]) => 0 < value.length ).map( ([ key, value ]) => {

			const data = mapValues({
				'average': average( value ).toFixed( 2 ),
				'standardDeviation': standardDeviation( value ).toFixed( 2 ),
				'median': median( value ).toFixed( 2 ),
				'quantileRank60': ( quantileRank( value, 60 ) * 100 ).toFixed( 2 ),
				'quantileRank80': ( quantileRank( value, 80 ) * 100 ).toFixed( 2 )
			}, parseFloat );

			if ( 'type' === key ) {
				data.above60 = value.map( ( x, i ) => ({ i, x, render: `${i} - ${x.toFixed( 2  )}` }) ).filter( ({ x }) => 60 < x ).map( ({ render }) => render ).join( ', ' );
			}

			return [ `${key}`, data ];
		});
		results.summary = Object.fromEntries( summary );

		const resultsFilename = basename( __filename, '.js' ) + '.results.json';
		writeFileSync(
			join( __dirname, resultsFilename ),
			JSON.stringify( results, null, 2 )
		);
		deleteFile( traceFile );
	});

	beforeEach( async() => {

		// Disable auto-save to avoid impacting the metrics.
		await page.evaluate( () => {
			window.wp.data.dispatch( 'core/editor' ).updateEditorSettings({
				autosaveInterval: 100000000000,
				localAutosaveInterval: 100000000000
			});
		});
	});

	it( 'Typing', async() => {

		// Measuring typing performance.
		await insertBlock( 'Advanced Heading' );
		let i = 100;
		await page.tracing.start({
			path: traceFile,
			screenshots: false,
			categories: [ 'devtools.timeline' ]
		});
		while ( i-- ) {

			// Wait for the browser to be idle before starting the monitoring.
			// The timeout should be big enough to allow all async tasks tor run.
			// And also to allow Rich Text to mark the change as persistent.
			// eslint-disable-next-line no-restricted-syntax
			await page.waitForTimeout( 2000 );
			await page.keyboard.type( 'x' );
		}
		await page.tracing.stop();
		traceResults = JSON.parse( readFile( traceFile ) );
		const [ keyDownEvents, keyPressEvents, keyUpEvents ] =
			getTypingEventDurations( traceResults );
		if (
			keyDownEvents.length === keyPressEvents.length &&
			keyPressEvents.length === keyUpEvents.length
		) {

			// The first character typed triggers a longer time (isTyping change)
			// It can impact the stability of the metric, so we exclude it.
			for ( let j = 1; j < keyDownEvents.length; j++ ) {
				results.type.push(
					keyDownEvents[ j ] + keyPressEvents[ j ] + keyUpEvents[ j ]
				);
			}
		}
		await saveDraft();

		expect( 0 < results.type.length ).toBe( true );
	});

	// it( 'Loading', async() => {

	// 	// Measuring loading time.
	// 	let i = 5;
	// 	while ( i-- ) {
	// 		if ( await page.$( '.editor-post-save-draft' ) ) {
	// 			await saveDraft();
	// 		}
	// 		await page.reload();

	// 		await page.waitForSelector( '.wp-block' );
	// 		const {
	// 			serverResponse,
	// 			firstPaint,
	// 			domContentLoaded,
	// 			loaded,
	// 			firstContentfulPaint,
	// 			firstBlock
	// 		} = await getLoadingDurations();

	// 		results.serverResponse.push( serverResponse );
	// 		results.firstPaint.push( firstPaint );
	// 		results.domContentLoaded.push( domContentLoaded );
	// 		results.loaded.push( loaded );
	// 		results.firstContentfulPaint.push( firstContentfulPaint );
	// 		results.firstBlock.push( firstBlock );
	// 	}
	// });

	// it( 'Selecting blocks', async() => {

	// 	// Measuring block selection performance.
	// 	await createNewPost();
	// 	await page.evaluate( () => {
	// 		const { createBlock } = window.wp.blocks;
	// 		const { dispatch } = window.wp.data;
	// 		const blocks = window.lodash
	// 			.times( 1000 )
	// 			.map( () => createBlock( 'core/paragraph' ) );
	// 		dispatch( 'core/block-editor' ).resetBlocks( blocks );
	// 	});
	// 	const paragraphs = await page.$$( '.wp-block' );
	// 	await page.tracing.start({
	// 		path: traceFile,
	// 		screenshots: false,
	// 		categories: [ 'devtools.timeline' ]
	// 	});
	// 	await paragraphs[ 0 ].click();
	// 	for ( let j = 1; 10 >= j; j++ ) {

	// 		// Wait for the browser to be idle before starting the monitoring.
	// 		// eslint-disable-next-line no-restricted-syntax
	// 		await page.waitForTimeout( 1000 );
	// 		await paragraphs[ j ].click();
	// 	}
	// 	await page.tracing.stop();
	// 	traceResults = JSON.parse( readFile( traceFile ) );
	// 	const [ focusEvents ] = getSelectionEventDurations( traceResults );
	// 	results.focus = focusEvents;
	// 	await saveDraft();

	// 	const sum = results.focus.reduce( ( s, x ) => s + x, 0 );
	// 	const avg = sum / results.focus.length;
	// 	results.summary.focusAvg = avg;
	// });

	// it( 'Opening persistent list view', async() => {

	// 	// Measure time to open inserter.
	// 	await page.waitForSelector( '.edit-post-layout' );
	// 	for ( let j = 0; 10 > j; j++ ) {
	// 		await page.tracing.start({
	// 			path: traceFile,
	// 			screenshots: false,
	// 			categories: [ 'devtools.timeline' ]
	// 		});
	// 		await openListView();
	// 		await page.tracing.stop();
	// 		traceResults = JSON.parse( readFile( traceFile ) );
	// 		const [ mouseClickEvents ] = getClickEventDurations( traceResults );
	// 		for ( let k = 0; k < mouseClickEvents.length; k++ ) {
	// 			results.listViewOpen.push( mouseClickEvents[ k ]);
	// 		}
	// 		await closeListView();
	// 	}
	// });

	// it( 'Opening the inserter', async() => {

	// 	// Measure time to open inserter.
	// 	await page.waitForSelector( '.edit-post-layout' );
	// 	for ( let j = 0; 10 > j; j++ ) {
	// 		await page.tracing.start({
	// 			path: traceFile,
	// 			screenshots: false,
	// 			categories: [ 'devtools.timeline' ]
	// 		});
	// 		await openGlobalBlockInserter();
	// 		await page.tracing.stop();
	// 		traceResults = JSON.parse( readFile( traceFile ) );
	// 		const [ mouseClickEvents ] = getClickEventDurations( traceResults );
	// 		for ( let k = 0; k < mouseClickEvents.length; k++ ) {
	// 			results.inserterOpen.push( mouseClickEvents[ k ]);
	// 		}
	// 		await closeGlobalBlockInserter();
	// 	}
	// });

	// it( 'Searching the inserter', async() => {
	// 	function sum( arr ) {
	// 		return arr.reduce( ( a, b ) => a + b, 0 );
	// 	}

	// 	// Measure time to search the inserter and get results.
	// 	await openGlobalBlockInserter();
	// 	for ( let j = 0; 10 > j; j++ ) {

	// 		// Wait for the browser to be idle before starting the monitoring.
	// 		// eslint-disable-next-line no-restricted-syntax
	// 		await page.waitForTimeout( 500 );
	// 		await page.tracing.start({
	// 			path: traceFile,
	// 			screenshots: false,
	// 			categories: [ 'devtools.timeline' ]
	// 		});
	// 		await page.keyboard.type( 'p' );
	// 		await page.tracing.stop();
	// 		traceResults = JSON.parse( readFile( traceFile ) );
	// 		const [ keyDownEvents, keyPressEvents, keyUpEvents ] =
	// 			getTypingEventDurations( traceResults );
	// 		if (
	// 			keyDownEvents.length === keyPressEvents.length &&
	// 			keyPressEvents.length === keyUpEvents.length
	// 		) {
	// 			results.inserterSearch.push(
	// 				sum( keyDownEvents ) +
	// 					sum( keyPressEvents ) +
	// 					sum( keyUpEvents )
	// 			);
	// 		}
	// 		await page.keyboard.press( 'Backspace' );
	// 	}
	// 	await closeGlobalBlockInserter();
	// });

	// it( 'Hovering Inserter Items', async() => {

	// 	// Measure inserter hover performance.
	// 	const paragraphBlockItem =
	// 		'.block-editor-inserter__menu .editor-block-list-item-paragraph';
	// 	const headingBlockItem =
	// 		'.block-editor-inserter__menu .editor-block-list-item-heading';
	// 	await openGlobalBlockInserter();
	// 	await page.waitForSelector( paragraphBlockItem );
	// 	await page.hover( paragraphBlockItem );
	// 	await page.hover( headingBlockItem );
	// 	for ( let j = 0; 10 > j; j++ ) {

	// 		// Wait for the browser to be idle before starting the monitoring.
	// 		// eslint-disable-next-line no-restricted-syntax
	// 		await page.waitForTimeout( 200 );
	// 		await page.tracing.start({
	// 			path: traceFile,
	// 			screenshots: false,
	// 			categories: [ 'devtools.timeline' ]
	// 		});
	// 		await page.hover( paragraphBlockItem );
	// 		await page.hover( headingBlockItem );
	// 		await page.tracing.stop();

	// 		traceResults = JSON.parse( readFile( traceFile ) );
	// 		const [ mouseOverEvents, mouseOutEvents ] =
	// 			getHoverEventDurations( traceResults );
	// 		for ( let k = 0; k < mouseOverEvents.length; k++ ) {
	// 			results.inserterHover.push(
	// 				mouseOverEvents[ k ] + mouseOutEvents[ k ]
	// 			);
	// 		}
	// 	}
	// 	await closeGlobalBlockInserter();
	// });
});
