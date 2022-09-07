/**
 * Internal dependencies
 */
import { domReady } from '../../helpers/frontend-helper-functions';


// Time constants
const _MS_PER_SECONDS = 1000;
const _MS_PER_MINUTES = _MS_PER_SECONDS * 60;
const _MS_PER_HOURS = _MS_PER_MINUTES * 60;
const _MS_PER_DAY = _MS_PER_HOURS * 24;

const COUNTDOWN_RESET = _MS_PER_DAY * 30;

type Settings = {
	exclude: string[]
	keepNeg: boolean
}

let indexGenerator: number = 0;

class CountdownData {


	readonly id: number;
	readonly elem: HTMLDivElement;
	readonly mode?: 'timer';
	readonly rawData: string;
	readonly timer: string;
	readonly settings?: Settings;
	readonly targetDate: number;
	readonly behaviour: 'default' | 'redirectLink' | 'showBlock' | 'hideBlock' | 'disappear' | string;
	readonly redirectLink?: string;
	readonly components: {
		second?: {
			label?: Element
			value?: Element
		}
		minute?: {
			label?: Element
			value?: Element
		}
		hour?: {
			label?: Element
			value?: Element
		}
		day?: {
			label?: Element
			value?: Element
		}
	};
	readonly onEndEvents: ( () => void )[];

	constructor( elem: HTMLDivElement ) {
		this.id = indexGenerator++;
		this.elem = elem;

		elem.classList.add( 'ready' );

		const { date, bhv, mode, timer, redirectLink } = elem.dataset;
		console.log( elem.dataset );
		this.rawData = date ?? '';
		this.behaviour = bhv ?? 'default';

		this.mode = mode as 'timer' | undefined;
		this.timer = timer ?? '0';

		this.redirectLink = redirectLink;
		console.log( this.redirectLink );

		this.components = {};
		[ 'second', 'minute', 'hour', 'day' ].forEach(
			( componentName ) => {
				const _elem = elem.querySelector( `div[name=${ componentName }]` );
				if ( _elem ) {
					const labelElem = _elem.querySelector( '.otter-countdown__label' );
					const valueElem = _elem.querySelector( '.otter-countdown__value' );
					this.components[ componentName as 'second'| 'minute'| 'hour'| 'day'] = {
						label: labelElem ?? undefined,
						value: valueElem ?? undefined
					};
				}
			}
		);

		this.onEndEvents = [ () => this.triggerBehaviour() ];

		document.querySelectorAll( `${this.blockLink}.o-cntdn-bhv-hide` ).forEach(
			blockElem => {
				if ( ! this.isStopped ) {
					( blockElem as HTMLDivElement ).classList.add( '.o-cntdn-ready' );
				}
			}
		);

		if ( 'timer' === this.mode ) {

			//const lastVisit = localStorage.getItem( `o-countdown-last-visit-${this.elem.id}` );
			const lastVisit = localStorage.getItem( `o-countdown-last-visit-${this.elem.id}` );
			console.log( lastVisit );

			if (
				! lastVisit ||
				( ( parseInt( lastVisit ) + parseInt( this.timer ) - Date.now() ) > COUNTDOWN_RESET )
			) {
				localStorage.setItem( `o-countdown-last-visit-${this.elem.id}`, Date.now().toString() );
			}

			this.targetDate = parseInt( localStorage.getItem( `o-countdown-last-visit-${this.elem.id}` ) ) + parseInt( this.timer );

		} else {
			this.targetDate = ( new Date( this.rawData + ( window?.themeisleGutenbergCountdown?.timezone ?? '' ) ) ).getTime();
		}
	}

	get remainingTime(): number {
		return this.targetDate - Date.now();
	}

	get isStopped(): boolean {
		return 0  >= this.remainingTime;
	}

	updateComponents( states: {tag: 'second'| 'minute'| 'hour'| 'day', label: string, value: string}[]) {
		states.forEach( state => {
			if ( this.components?.[ state.tag ]?.label && this.components[ state.tag ]?.label?.innerHTML !== state.label ) {
				this.components[ state.tag ]!.label!.innerHTML = state.label ?? '';
			}

			if ( this.components?.[ state.tag ]?.value ) {
				this.components[ state.tag ]!.value!.innerHTML = state.value;
			}
		});
	}

	onEnd( f: () => void ): void {
		this.onEndEvents.push( f );
	}

	end() {
		console.log( 'End' );

		// This can be used by other scripts to see when the countdown ends.
		const event = new CustomEvent(
			'o-countdown-stop',
			{
				bubbles: true,
				detail: { countdown: this }
			}
		);

		this.elem.dispatchEvent( event );
		this.onEndEvents.forEach( f => f() );
	}

	get blockLink() {
		if ( this.elem.id === undefined ) {
			return null;
		}
		return `.o-countdown-trigger-on-end-${this.elem.id.split( '-' ).pop()}`;
	}

	triggerBehaviour() {
		const blockSelectorId = this.blockLink;

		console.log( blockSelectorId );

		switch ( this.behaviour as 'default' | 'redirectLink' | 'showBlock' | 'hideBlock' | 'disappear' ) {
		case 'default':
			break;
		case 'disappear':
			this.elem.style.display = 'none';
			break;
		case 'hideBlock':
			if ( blockSelectorId ) {
				document.querySelectorAll( `${blockSelectorId}.o-cntdn-bhv-hide` ).forEach(
					blockElem => {
						console.log( blockElem );
						( blockElem as HTMLDivElement ).classList.add( 'o-cntdn-hide' );
					}
				);
			}
			break;
		case 'showBlock':
			if ( blockSelectorId ) {
				document.querySelectorAll( `${blockSelectorId}.o-cntdn-bhv-show` ).forEach(
					blockElem => {
						( blockElem as HTMLDivElement ).classList.remove( 'o-cntdn-bhv-show' );
					}
				);
			}
			break;
		case 'redirectLink':
			if ( this.redirectLink ) {
				window.location.replace( this.redirectLink );
			}
			break;
		}
	}
}

class CountdownRunner {

	countdowns: { [key: string]: CountdownData};
	timer!: ReturnType<typeof setInterval>;
	running: Set<number>;
	stopped: Set<number>;

	constructor() {
		this.countdowns = {};
		this.running = new Set<number>();
		this.stopped = new Set<number>();
	}

	register( countdown: CountdownData ) {
		if ( countdown ) {

			countdown.onEnd( () => {
				this.running.delete( countdown.id );
				this.stopped.add( countdown.id );
			});


			this.countdowns[countdown.id] = countdown;
			this.running.add( countdown.id );
		}
	}

	startTimer( interval: number = 300 ) {
		this.timer = setInterval( () => {
			this.running.forEach( ( countdown ) => {
				this.updateCountdown( this.countdowns[countdown] as CountdownData );
			});

			if ( 0 === this.running.size ) {
				this.stopTimer();
			}
		}, interval );
	}

	stopTimer() {
		clearInterval( this.timer );
	}

	updateCountdown( countdown: CountdownData ) {
		const { id } = countdown;
		try {
			const { remainingTime } = countdown;

			const days = Math.floor( remainingTime / _MS_PER_DAY );
			const hours = Math.floor( remainingTime / _MS_PER_HOURS % 24 );
			const minutes = Math.floor( remainingTime / _MS_PER_MINUTES % 60 );
			const seconds = Math.floor( remainingTime / _MS_PER_SECONDS % 60 );

			const { i18n } = window.themeisleGutenbergCountdown;

			const time = [
				{
					tag: 'day',
					label: 1 < days ? i18n.days : i18n.day,
					value: days
				},
				{
					tag: 'hour',
					label: 1 < hours ? i18n.hours : i18n.hour,
					value: hours
				},
				{
					tag: 'minute',
					label: 1 < minutes ? i18n.minutes : i18n.minute,
					value: minutes
				},
				{
					tag: 'second',
					label: 1 < seconds ? i18n.seconds : i18n.second,
					value: seconds
				}
			]
				.filter( ({ tag }) => ! countdown.settings?.exclude?.includes( tag ) )
				.map( obj => {
					return {
						...obj,
						value: ! countdown.settings?.keepNeg ? ( Math.max( 0, obj.value ) ).toString() : obj.value.toString()
					};
				}) as {tag: 'second'| 'minute'| 'hour'| 'day', label: string, value: string}[];

			countdown.updateComponents( time );

			if ( countdown.isStopped ) {
				countdown.end();
			}
		} catch ( error ) {
			console.error( error );
			this.running.delete( id );
		}
	}
}

domReady( () => {
	const countdowns = document.querySelectorAll( '.wp-block-themeisle-blocks-countdown' );

	const runner = new CountdownRunner();

	countdowns.forEach( countdown => {
		const c = new CountdownData( countdown as HTMLDivElement );
		runner.register( c );
	});

	runner.startTimer();
});
