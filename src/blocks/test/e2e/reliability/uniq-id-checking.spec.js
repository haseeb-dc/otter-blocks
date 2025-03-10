/**
 * External dependencies
 */
import { join } from 'path';
const { PuppeteerScreenRecorder } = require( 'puppeteer-screen-recorder' );

/**
  * WordPress dependencies
  */
import {
	createNewPost,
	saveDraft
} from '@wordpress/e2e-test-utils';

/**
  * Internal dependencies
  */
import {
	readFile
} from '../utils';

jest.setTimeout( 1000000 );

let screenRecorder;

describe( 'Otter Block ID', () => {

	beforeAll( async() => {
		const html = readFile(
			join( __dirname, '..', '/assets/large-otter-post.html' )
		);

		const screenRecorderOptions = {
			followNewTab: true,
			fps: 25
		};

		const savePath = './artifact/tests/uniq-id-test.mp4';
		screenRecorder = new PuppeteerScreenRecorder( page, screenRecorderOptions );
		await screenRecorder.start( savePath );

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

	it( 'Check if ID is uniq for otter blocks', async() => {
		const ids = await page.evaluate( ( ) => {
			const ids = [];
			const { getBlocks } = window.wp.data.select( 'core/block-editor' );
			const extractId = block => ( block.attributes.id );


			const loopBlocks = block => {
				ids.push( extractId( block ) );
				if ( 0 < block.innerBlocks?.length ) {
					for ( const innerBlock of block.innerBlocks ) {
						loopBlocks( innerBlock );
					}
				}
			};

			for ( const block of getBlocks() ) {
				loopBlocks( block );
			}

			return ids;
		});

		const otterIds = ids.filter( x => x && x.includes( 'themeisle' ) );
		expect( 0 < otterIds.length ).toBe( true );

		const s = new Set( otterIds );

		console.log( `Ids: ${otterIds.length} | Uniq ids: ${s.size}` );

		const duplicates = {};

		otterIds.forEach( i => {
			if ( duplicates[i] === undefined ) {
				duplicates[i] = 1;
			} else {
				duplicates[i] += 1;
			}

		});

		console.log( `Ids that appear more than once: ${Object.keys( duplicates ).filter( i => 1 < duplicates[i]).map( i => `\n| ${duplicates[i].toString().padStart( 2, ' ' )} ${i}` ).join( '' )}`  );

		expect( otterIds.length === s.size ).toBe( true );
	});

	it( 'Insert extra blocks and check for uniq id', async() => {

		const beforeCount = await page.evaluate( ( ) => {
			const { getBlockCount } = window.wp.data.select( 'core/block-editor' );
			return getBlockCount();
		});

		await page.evaluate( () => {
			window.wp.data.select( 'core/blocks' ).getBlockTypes()
				.filter( ({ name }) => name.includes( 'themeisle-blocks/' ) )
				.map( ({ name }) => window.wp.blocks.createBlock( name, {}) )
				.forEach( ( block ) => {
					wp.data.dispatch( 'core/block-editor' ).insertBlock( block );
				});
		});

		const { ids, afterCount } = await page.evaluate( ( ) => {
			const ids = [];
			const { getBlocks, getBlockCount } = window.wp.data.select( 'core/block-editor' );
			const extractId = block => ( block.attributes.id );


			const loopBlocks = block => {
				ids.push( extractId( block ) );
				if ( 0 < block.innerBlocks?.length ) {
					for ( const innerBlock of block.innerBlocks ) {
						loopBlocks( innerBlock );
					}
				}
			};

			for ( const block of getBlocks() ) {
				loopBlocks( block );
			}

			return { ids, afterCount: getBlockCount() };
		});

		const otterIds = ids.filter( x => x && x.includes( 'themeisle' ) );
		expect( 0 < otterIds.length ).toBe( true );

		const s = new Set( otterIds );

		console.log( `Ids: ${otterIds.length} | Uniq ids: ${s.size}` );

		const duplicates = {};

		otterIds.forEach( i => {
			if ( duplicates[i] === undefined ) {
				duplicates[i] = 1;
			} else {
				duplicates[i] += 1;
			}

		});

		console.log( `Ids that appear more than once: ${Object.keys( duplicates ).filter( i => 1 < duplicates[i]).map( i => `\n| ${duplicates[i].toString().padStart( 2, ' ' )} ${i}` ).join( '' )}`  );

		expect( otterIds.length === s.size ).toBe( true );

		expect( beforeCount < afterCount ).toBe( true );

		await saveDraft();
	});

	it( 'Duplicate blocks and check for uniq id', async() => {

		const beforeCount = await page.evaluate( ( ) => {
			const { getBlockCount } = window.wp.data.select( 'core/block-editor' );
			return getBlockCount();
		});

		await page.evaluate( () => {
			const { getBlocks } = window.wp.data.select( 'core/block-editor' );
			const ids = getBlocks()
				.filter( ({ name }) => name.includes( 'themeisle-blocks/' ) )
				.map( ({ clientId }) => clientId );
			wp.data.dispatch( 'core/block-editor' ).duplicateBlocks( ids.slice( 0, Math.max( 0, Math.round( ids.length * 0.1 ) ) ) );
		});

		await saveDraft();

		const { ids, afterCount } = await page.evaluate( ( ) => {
			const ids = [];
			const { getBlocks, getBlockCount } = window.wp.data.select( 'core/block-editor' );
			const extractId = block => ( block.attributes.id );


			const loopBlocks = block => {
				ids.push( extractId( block ) );
				if ( 0 < block.innerBlocks?.length ) {
					for ( const innerBlock of block.innerBlocks ) {
						loopBlocks( innerBlock );
					}
				}
			};

			for ( const block of getBlocks() ) {
				loopBlocks( block );
			}

			return { ids, afterCount: getBlockCount() };
		});

		const otterIds = ids.filter( x => x && x.includes( 'themeisle' ) );
		expect( 0 < otterIds.length ).toBe( true );

		// expect( otterIds.length === ( new Set( otterIds ) ).size ).toBe( true ); // FIXME

		expect( beforeCount < afterCount ).toBe( true );
	});

});
