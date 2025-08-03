// Secure Configuration Management for Netlify Deployment
// This file handles environment variables and secure configuration loading

class SecureConfig {
    constructor() {
        this.config = null;
        this.isProduction = this.detectEnvironment();
        this.isNetlify = this.detectNetlify();
    }

    detectEnvironment() {
        // Check for Netlify environment
        if (window.location.hostname.includes('netlify.app') || 
            window.location.hostname.includes('netlify.com')) {
            return true;
        }
        
        // Check for other production indicators
        return window.location.hostname !== 'localhost' && 
               window.location.hostname !== '127.0.0.1' && 
               !window.location.hostname.includes('local') &&
               window.location.protocol === 'https:';
    }

    detectNetlify() {
        return window.location.hostname.includes('netlify.app') || 
               window.location.hostname.includes('netlify.com') ||
               (window.location.hostname !== 'localhost' && window.netlifyIdentity);
    }

    async loadConfig() {
        if (this.config) return this.config;

        try {
            // Load configuration based on environment
            this.config = await this.loadEnvironmentConfig();
            
            // Validate configuration
            if (!this.validateConfig()) {
                throw new Error('Invalid configuration loaded');
            }

            console.log(`✅ Configuration loaded for ${this.config.environment} environment`);
            return this.config;

        } catch (error) {
            console.error('❌ Failed to load configuration:', error);
            // Fallback to basic configuration
            return this.getFallbackConfig();
        }
    }

    async loadEnvironmentConfig() {
        if (this.isNetlify || this.isProduction) {
            // Production/Netlify environment - use build-time injected variables
            return {
                // Core Supabase Configuration
                supabaseUrl: this.getEnvVar('VITE_SUPABASE_URL') || this.getEnvVar('SUPABASE_URL'),
                supabaseAnonKey: this.getEnvVar('VITE_SUPABASE_ANON_KEY') || this.getEnvVar('SUPABASE_ANON_KEY'),
                
                // Application Configuration
                environment: this.getEnvVar('VITE_APP_ENV', 'production'),
                appName: this.getEnvVar('VITE_APP_NAME', 'Society Management System'),
                appVersion: this.getEnvVar('VITE_APP_VERSION', '1.2.0'),
                baseUrl: this.getEnvVar('VITE_APP_BASE_URL', window.location.origin),
                
                // Security Configuration
                sessionTimeout: parseInt(this.getEnvVar('VITE_SESSION_TIMEOUT', '7200000')), // 2 hours
                maxIdleTime: parseInt(this.getEnvVar('VITE_MAX_IDLE_TIME', '900000')), // 15 minutes
                enableRateLimiting: this.getBooleanEnvVar('VITE_ENABLE_RATE_LIMITING', true),
                enableSessionMonitoring: this.getBooleanEnvVar('VITE_ENABLE_SESSION_MONITORING', true),
                enableSecurityLogging: this.getBooleanEnvVar('VITE_ENABLE_SECURITY_LOGGING', true),
                
                // Rate Limiting
                rateLimitMaxAttempts: parseInt(this.getEnvVar('VITE_RATE_LIMIT_MAX_ATTEMPTS', '5')),
                rateLimitWindowMs: parseInt(this.getEnvVar('VITE_RATE_LIMIT_WINDOW_MS', '900000')),
                
                // PWA Configuration
                enablePWA: this.getBooleanEnvVar('VITE_ENABLE_PWA', true),
                enableServiceWorker: this.getBooleanEnvVar('VITE_ENABLE_SERVICE_WORKER', true),
                enablePushNotifications: this.getBooleanEnvVar('VITE_ENABLE_PUSH_NOTIFICATIONS', false),
                pwaUpdateCheckInterval: parseInt(this.getEnvVar('VITE_PWA_UPDATE_CHECK_INTERVAL', '3600000')),
                
                // Feature Flags
                enableDarkMode: this.getBooleanEnvVar('VITE_ENABLE_DARK_MODE', true),
                enableAnalytics: this.getBooleanEnvVar('VITE_ENABLE_ANALYTICS', false),
                enableErrorReporting: this.getBooleanEnvVar('VITE_ENABLE_ERROR_REPORTING', false),
                enableDevTools: this.getBooleanEnvVar('VITE_ENABLE_DEV_TOOLS', !this.isProduction),
                enableConsoleLogging: this.getBooleanEnvVar('VITE_ENABLE_CONSOLE_LOGGING', !this.isProduction),
                
                // Password Requirements
                minPasswordLength: parseInt(this.getEnvVar('VITE_MIN_PASSWORD_LENGTH', '12')),
                requireSpecialChars: this.getBooleanEnvVar('VITE_REQUIRE_SPECIAL_CHARS', true),
                requireNumbers: this.getBooleanEnvVar('VITE_REQUIRE_NUMBERS', true),
                requireUppercase: this.getBooleanEnvVar('VITE_REQUIRE_UPPERCASE', true),
                
                // Session Security
                enableSessionEncryption: this.getBooleanEnvVar('VITE_ENABLE_SESSION_ENCRYPTION', true),
                enableCSRFProtection: this.getBooleanEnvVar('VITE_ENABLE_CSRF_PROTECTION', true),
                
                // Cache Configuration
                cacheVersion: this.getEnvVar('VITE_CACHE_VERSION', '1.2.0'),
                cacheMaxAge: parseInt(this.getEnvVar('VITE_CACHE_MAX_AGE', '86400000')),
                cacheStrategy: this.getEnvVar('VITE_CACHE_STRATEGY', 'stale-while-revalidate'),
                
                // Build Configuration
                buildTarget: this.getEnvVar('VITE_BUILD_TARGET', 'netlify'),
                deployContext: this.getEnvVar('VITE_DEPLOY_CONTEXT', 'production')
            };
        } else {
            // Development environment
            return {
                supabaseUrl: this.getEnvVar('VITE_SUPABASE_URL', 'https://lvsekyzhwwaezwfltxzr.supabase.co'),
                supabaseAnonKey: this.getEnvVar('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2c2VreXpod3dhZXp3Zmx0eHpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5MjYyOTYsImV4cCI6MjA2NjUwMjI5Nn0.ZvHWrqxohHLGzLJIDgSr_y1L4MfMsO_bWdERxAoakK8'),
                environment: 'development',
                appName: 'Society Management System',
                appVersion: '1.2.0',
                baseUrl: window.location.origin,
                sessionTimeout: 2 * 60 * 60 * 1000, // 2 hours
                maxIdleTime: 15 * 60 * 1000, // 15 minutes
                enableRateLimiting: true,
                enableSessionMonitoring: true,
                enableSecurityLogging: true,
                rateLimitMaxAttempts: 5,
                rateLimitWindowMs: 15 * 60 * 1000,
                enablePWA: true,
                enableServiceWorker: true,
                enablePushNotifications: false,
                pwaUpdateCheckInterval: 60 * 60 * 1000,
                enableDarkMode: true,
                enableAnalytics: false,
                enableErrorReporting: false,
                enableDevTools: true,
                enableConsoleLogging: true,
                minPasswordLength: 12,
                requireSpecialChars: true,
                requireNumbers: true,
                requireUppercase: true,
                enableSessionEncryption: true,
                enableCSRFProtection: true,
                cacheVersion: '1.2.0',
                cacheMaxAge: 24 * 60 * 60 * 1000,
                cacheStrategy: 'stale-while-revalidate',
                buildTarget: 'development',
                deployContext: 'development'
            };
        }
    }

    getEnvVar(name, defaultValue = null) {
        // Try window.__ENV (runtime injection from Netlify)
        if (typeof window !== 'undefined' && window.__ENV) {
            const value = window.__ENV[name];
            if (value !== undefined) return value;
        }
        
        // Try process.env (Node.js environment - for build time)
        if (typeof process !== 'undefined' && process.env) {
            const value = process.env[name];
            if (value !== undefined) return value;
        }
        
        // Try different naming conventions for Netlify environment variables
        const variations = [
            name,
            `VITE_${name}`,
            `REACT_APP_${name}`,
            name.replace('VITE_', ''),
            name.replace('REACT_APP_', '')
        ];
        
        for (const variation of variations) {
            // Check window.__ENV for each variation
            if (typeof window !== 'undefined' && window.__ENV && window.__ENV[variation] !== undefined) {
                return window.__ENV[variation];
            }
            
            // Check process.env for each variation
            if (typeof process !== 'undefined' && process.env && process.env[variation] !== undefined) {
                return process.env[variation];
            }
            
            // For Netlify builds, environment variables might be directly available on window
            if (typeof window !== 'undefined' && window[variation] !== undefined) {
                return window[variation];
            }
        }

        return defaultValue;
    }

    getBooleanEnvVar(name, defaultValue = false) {
        const value = this.getEnvVar(name);
        if (value === null || value === undefined) return defaultValue;
        
        // Handle string boolean values
        if (typeof value === 'string') {
            return value.toLowerCase() === 'true' || value === '1';
        }
        
        return Boolean(value);
    }

    getFallbackConfig() {
        console.warn('⚠️ Using fallback configuration');
        return {
            supabaseUrl: 'https://lvsekyzhwwaezwfltxzr.supabase.co',
            supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2c2VreXpod3dhZXp3Zmx0eHpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5MjYyOTYsImV4cCI6MjA2NjUwMjI5Nn0.ZvHWrqxohHLGzLJIDgSr_y1L4MfMsO_bWdERxAoakK8',
            environment: 'fallback',
            appName: 'Society Management System',
            appVersion: '1.2.0',
            baseUrl: window.location.origin,
            sessionTimeout: 2 * 60 * 60 * 1000,
            maxIdleTime: 15 * 60 * 1000,
            enableRateLimiting: true,
            enableSessionMonitoring: true,
            enableSecurityLogging: false,
            rateLimitMaxAttempts: 5,
            rateLimitWindowMs: 15 * 60 * 1000,
            enablePWA: true,
            enableServiceWorker: true,
            enablePushNotifications: false,
            pwaUpdateCheckInterval: 60 * 60 * 1000,
            enableDarkMode: true,
            enableAnalytics: false,
            enableErrorReporting: false,
            enableDevTools: false,
            enableConsoleLogging: false,
            minPasswordLength: 8,
            requireSpecialChars: false,
            requireNumbers: true,
            requireUppercase: false,
            enableSessionEncryption: true,
            enableCSRFProtection: true,
            cacheVersion: '1.0.0',
            cacheMaxAge: 24 * 60 * 60 * 1000,
            cacheStrategy: 'cache-first',
            buildTarget: 'fallback',
            deployContext: 'unknown'
        };
    }

    getSupabaseConfig() {
        if (!this.config) {
            throw new Error('Configuration not loaded. Call loadConfig() first.');
        }
        
        return {
            url: this.config.supabaseUrl,
            anonKey: this.config.supabaseAnonKey
        };
    }

    isProductionEnvironment() {
        return this.isProduction;
    }

    // Security validation
    validateConfig() {
        if (!this.config) return false;
        
        const required = ['supabaseUrl', 'supabaseAnonKey'];
        return required.every(key => this.config[key] && this.config[key].length > 0);
    }
}

// Global configuration instance
window.SecureConfig = new SecureConfig();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecureConfig;
}