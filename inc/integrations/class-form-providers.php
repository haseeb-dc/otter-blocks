<?php

namespace ThemeIsle\GutenbergBlocks\Integration;

use Exception;

class Form_Providers
{
	/**
	 * The main instance var.
	 *
	 * @var Form_Providers
	 */
	public static $instance = null;

    /**
     * @var array List of provider and their actions when a form is submitted.
     */
	public $providers = array();

	/**
	 * The instance method for the static class.
	 * Defines and returns the instance of the static class.
	 *
	 * @static
	 * @since 2.0.1
	 * @access public
	 * @return Form_Providers
	 */
	public static function instance() {
		if ( is_null( self::$instance ) ) {
			self::$instance = new self();
			self::$instance->init();
		}

		return self::$instance;
	}

    /**
     * Add action and filters.
     * @return void
     */
	public function init() {
        /**
         * Add action that register a provider and his actions when a form is submitted.
         */
		add_action('otter_register_form_providers', array($this, 'register_providers'));

        /**
         * Add a filter that select the provider from the form integration settings.
         */
		add_filter('otter_select_form_provider', array($this, 'select_provider_from_form_options'));
	}

	/**
	 * Register an email provider.
	 * @param array $new_providers
	 * @return void
	 * @throws Exception
	 */
	public function register_providers($new_providers ) {
		foreach ($new_providers as $name => $handlers) {
			if( array_key_exists($name, $this->providers) ) {
				throw new Exception('Provider ' . $name . ' is already registered.');
			}
		}

		$this->providers = array_merge_recursive($this->providers, $new_providers);
	}

    /**
     * Select the provider based on the form integration settings.
     * @param Form_Data_Request $form_request
     * @return array|bool
	 */
	public function select_provider_from_form_options($form_request) {
		$form_options = $form_request->get_form_options();
        if( $form_options->has_provider() && $form_options->has_credentials() ) {
            return $this->get_provider_handlers($form_options->get_provider());
        }

        return $this->get_provider_handlers();
	}

	/**
	 * Get the provider.
	 * @param string $provider_name
	 * @param string $scope
	 * @return array|bool
	 */
	public function get_provider_handlers($provider_name = 'default' , $scope = 'frontend' ) {
		if( array_key_exists($provider_name, $this->providers) ) {
			return $this->providers[$provider_name][$scope];
		}
		return false;
	}

	/**
	 * @param $provider
	 * @param $handler
	 * @return bool
	 */
	public static function provider_has_handler( $provider, $handler ) {
		return array_key_exists($handler, $provider);
	}

	/**
	 * Throw error on object clone
	 *
	 * The whole idea of the singleton design pattern is that there is a single
	 * object therefore, we don't want the object to be cloned.
	 *
	 * @access public
	 * @since 2.0.1
	 * @return void
	 */
	public function __clone() {
		// Cloning instances of the class is forbidden.
		_doing_it_wrong( __FUNCTION__, esc_html__( 'Cheatin&#8217; huh?', 'otter-blocks' ), '1.0.0' );
	}

	/**
	 * Disable unserializing of the class
	 *
	 * @access public
	 * @since 2.0.1
	 * @return void
	 */
	public function __wakeup() {
		// Unserializing instances of the class is forbidden.
		_doing_it_wrong( __FUNCTION__, esc_html__( 'Cheatin&#8217; huh?', 'otter-blocks' ), '1.0.0' );
	}
}
