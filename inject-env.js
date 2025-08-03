// Environment Variable Injection for Netlify
// This script runs at build time to inject environment variables into the window object

(function() {
    'use strict';
    
    // Inject Netlify environment variables into window.__ENV
    if (typeof window !== 'undefined') {
        window.__ENV = window.__ENV || {};
        
        // Netlify injects environment variables as global variables during build
        // We collect them and make them available to our config system
        
        const envVars = [
            'VITE_SUPABASE_URL',
            'VITE_SUPABASE_ANON_KEY',
            'VITE_APP_ENV',
            'VITE_APP_NAME',
            'VITE_APP_VERSION',
            'VITE_APP_BASE_URL',
            'VITE_SESSION_TIMEOUT',
            'VITE_MAX_IDLE_TIME',
            'VITE_ENABLE_RATE_LIMITING',
            'VITE_ENABLE_SESSION_MONITORING',
            'VITE_ENABLE_SECURITY_LOGGING',
            'VITE_RATE_LIMIT_MAX_ATTEMPTS',
            'VITE_RATE_LIMIT_WINDOW_MS',
            'VITE_ENABLE_PWA',
            'VITE_ENABLE_SERVICE_WORKER',
            'VITE_ENABLE_PUSH_NOTIFICATIONS',
            'VITE_PWA_UPDATE_CHECK_INTERVAL',
            'VITE_ENABLE_DARK_MODE',
            'VITE_ENABLE_ANALYTICS',
            'VITE_ENABLE_ERROR_REPORTING',
            'VITE_ENABLE_DEV_TOOLS',
            'VITE_ENABLE_CONSOLE_LOGGING',
            'VITE_MIN_PASSWORD_LENGTH',
            'VITE_REQUIRE_SPECIAL_CHARS',
            'VITE_REQUIRE_NUMBERS',
            'VITE_REQUIRE_UPPERCASE',
            'VITE_ENABLE_SESSION_ENCRYPTION',
            'VITE_ENABLE_CSRF_PROTECTION',
            'VITE_CACHE_VERSION',
            'VITE_CACHE_MAX_AGE',
            'VITE_CACHE_STRATEGY',
            'VITE_BUILD_TARGET',
            'VITE_DEPLOY_CONTEXT'
        ];
        
        // Set fallback values for essential variables
        const fallbacks = {
            'VITE_SUPABASE_URL': 'https://lvsekyzhwwaezwfltxzr.supabase.co',
            'VITE_SUPABASE_ANON_KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2c2VreXpod3dhZXp3Zmx0eHpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5MjYyOTYsImV4cCI6MjA2NjUwMjI5Nn0.ZvHWrqxohHLGzLJIDgSr_y1L4MfMsO_bWdERxAoakK8',
            'VITE_APP_ENV': 'production',
            'VITE_APP_NAME': 'Society Management System',
            'VITE_APP_VERSION': '1.2.0',
            'VITE_APP_BASE_URL': window.location.origin,
            'VITE_ENABLE_PWA': 'true',
            'VITE_ENABLE_SERVICE_WORKER': 'true',
            'VITE_ENABLE_RATE_LIMITING': 'true',
            'VITE_ENABLE_SESSION_MONITORING': 'true',
            'VITE_ENABLE_DEV_TOOLS': 'false',
            'VITE_ENABLE_CONSOLE_LOGGING': 'false'
        };
        
        // Inject environment variables
        envVars.forEach(varName => {
            // Try to get from Netlify build environment
            let value = null;
            
            // Check if Netlify injected it as a global variable
            if (typeof window[varName] !== 'undefined') {
                value = window[varName];
            }
            // Check if it's available in a Netlify context object
            else if (typeof window.netlifyContext !== 'undefined' && window.netlifyContext[varName]) {
                value = window.netlifyContext[varName];
            }
            // Use fallback if available
            else if (fallbacks[varName]) {
                value = fallbacks[varName];
            }
            
            if (value !== null) {
                window.__ENV[varName] = value;
            }
        });
        
        console.log('🔧 Environment variables injected:', Object.keys(window.__ENV).length);
        
        // In development, log available variables (but not in production)
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('📋 Available environment variables:', Object.keys(window.__ENV));
        }
    }
})();