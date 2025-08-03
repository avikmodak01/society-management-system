// Admin Authentication Middleware
// Add this script to the beginning of each admin page

(function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        homeUrl: 'index.html', // URL to redirect to if not authenticated (now the landing page)
        sessionDuration: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
        modules: {
            'home.html': 'main-operations', // Main operations is now home.html
            'index.html': 'landing-page', // Landing page is now index.html (no auth needed)
            'admin.html': 'pin-management', 
            'admin_pin_management.html': 'pin-management', // Original filename
            'data-admin.html': 'data-admin',
            'data_deletion_tool.html': 'data-admin', // Original filename
            'main.html': 'main-operations', // Alternative name
            'operations.html': 'main-operations', // Alternative name
            '': 'landing-page' // If no filename (root index) - no auth needed
        }
    };
    
    // Get current page module
    function getCurrentModule() {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        console.log('🔍 Detecting current page:', currentPage);
        
        // Check direct mapping first
        if (CONFIG.modules[currentPage]) {
            console.log('✅ Module detected:', CONFIG.modules[currentPage]);
            return CONFIG.modules[currentPage];
        }
        
        // Check by document title or page content
        const title = document.title.toLowerCase();
        const bodyContent = document.body ? document.body.textContent.toLowerCase() : '';
        
        // Detect by title keywords
        if (title.includes('pin management') || title.includes('admin pin')) {
            console.log('✅ Module detected by title: pin-management');
            return 'pin-management';
        }
        
        if (title.includes('data deletion') || title.includes('supabase data')) {
            console.log('✅ Module detected by title: data-admin');
            return 'data-admin';
        }
        
        if (title.includes('society management') && title.includes('mini')) {
            console.log('✅ Module detected by title: main-operations');
            return 'main-operations';
        }
        
        // Detect by page content
        if (bodyContent.includes('pin management system') || bodyContent.includes('set/update pin')) {
            console.log('✅ Module detected by content: pin-management');
            return 'pin-management';
        }
        
        if (bodyContent.includes('data deletion tool') || bodyContent.includes('delete data from your database')) {
            console.log('✅ Module detected by content: data-admin');
            return 'data-admin';
        }
        
        if (bodyContent.includes('mini society management') || bodyContent.includes('member management')) {
            console.log('✅ Module detected by content: main-operations');
            return 'main-operations';
        }
        
        // Check URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const moduleParam = urlParams.get('module');
        if (moduleParam && CONFIG.modules[moduleParam]) {
            console.log('✅ Module detected by URL param:', CONFIG.modules[moduleParam]);
            return CONFIG.modules[moduleParam];
        }
        
        console.log('❌ Could not detect module for page:', currentPage);
        console.log('📄 Page title:', title);
        console.log('🔗 Available modules:', Object.keys(CONFIG.modules));
        
        return 'unknown';
    }
    
    // Check authentication
    function checkAuthentication() {
        const currentModule = getCurrentModule();
        const sessionKey = `admin_session_${currentModule}`;
        
        console.log('🔍 Auth Debug - Current Module:', currentModule);
        console.log('🔍 Auth Debug - Session Key:', sessionKey);
        
        try {
            const sessionData = localStorage.getItem(sessionKey);
            console.log('🔍 Auth Debug - Session Data exists:', !!sessionData);
            if (sessionData) {
                console.log('🔍 Auth Debug - Session Data length:', sessionData.length);
            }
            
            if (!sessionData) {
                redirectToHome('No authentication session found');
                return false;
            }
            
            // Try to decrypt session data first, fallback to plain JSON
            let session;
            console.log('🔍 Auth Debug - securityUtils available:', typeof securityUtils !== 'undefined');
            try {
                // Try decrypting (for new encrypted sessions)
                if (typeof securityUtils !== 'undefined' && securityUtils.decryptSessionData) {
                    console.log('🔍 Auth Debug - Attempting to decrypt session');
                    session = securityUtils.decryptSessionData(sessionData, 'session-key');
                    console.log('🔍 Auth Debug - Decryption successful');
                } else {
                    // Fallback to plain JSON (for legacy sessions)
                    console.log('🔍 Auth Debug - Using plain JSON parse');
                    session = JSON.parse(sessionData);
                }
            } catch (decryptError) {
                console.log('🔍 Auth Debug - Decryption failed, trying plain JSON:', decryptError.message);
                // If decryption fails, try plain JSON parse
                try {
                    session = JSON.parse(sessionData);
                    console.log('🔍 Auth Debug - Plain JSON parse successful');
                } catch (parseError) {
                    console.error('Failed to parse session data:', parseError);
                    localStorage.removeItem(sessionKey);
                    redirectToHome('Invalid session format');
                    return false;
                }
            }
            
            console.log('🔍 Auth Debug - Session parsed:', session);
            
            const now = Date.now();
            
            // Check if session is expired
            console.log('🔍 Auth Debug - Session expires:', new Date(session.expires));
            console.log('🔍 Auth Debug - Current time:', new Date(now));
            console.log('🔍 Auth Debug - Session expired?', now > session.expires);
            
            if (now > session.expires) {
                localStorage.removeItem(sessionKey);
                redirectToHome('Session expired. Please authenticate again');
                return false;
            }
            
            // Check if module matches
            console.log('🔍 Auth Debug - Session module:', session.module);
            console.log('🔍 Auth Debug - Current module:', currentModule);
            console.log('🔍 Auth Debug - Module match?', session.module === currentModule);
            
            if (session.module !== currentModule) {
                redirectToHome('Invalid session for this module');
                return false;
            }
            
            console.log(`✅ Authentication valid for ${currentModule} (${session.accessLevel})`);
            
            // Extend session if more than halfway through
            const halfDuration = CONFIG.sessionDuration / 2;
            if (now > (session.timestamp + halfDuration)) {
                session.expires = now + CONFIG.sessionDuration;
                localStorage.setItem(sessionKey, JSON.stringify(session));
                console.log('🔄 Session extended');
            }
            
            return true;
            
        } catch (error) {
            console.error('Authentication error:', error);
            localStorage.removeItem(sessionKey);
            redirectToHome('Authentication error occurred');
            return false;
        }
    }
    
    // Redirect to home page
    function redirectToHome(reason) {
        console.log('🚫 Redirecting to home:', reason);
        
        // Show user-friendly message
        if (typeof showAlert === 'function') {
            showAlert(reason, 'warning');
        } else {
            alert(reason);
        }
        
        // Redirect after a short delay
        setTimeout(() => {
            window.location.href = CONFIG.homeUrl;
        }, 1500);
    }
    
    // Setup logout functionality
    function setupLogout() {
        // Create logout button if it doesn't exist
        let logoutBtn = document.getElementById('adminLogoutBtn');
        
        if (!logoutBtn) {
            // Try to find existing logout button or create one
            const headerActions = document.querySelector('.header-actions');
            if (headerActions) {
                logoutBtn = document.createElement('button');
                logoutBtn.id = 'adminLogoutBtn';
                logoutBtn.className = 'btn btn-warning';
                logoutBtn.innerHTML = '🚪 Logout';
                logoutBtn.title = 'Logout from admin panel';
                headerActions.appendChild(logoutBtn);
            }
        }
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function() {
                if (confirm('Are you sure you want to logout from the admin panel?')) {
                    adminLogout();
                }
            });
        }
        
        // Setup automatic logout on window close
        window.addEventListener('beforeunload', function() {
            // Don't auto-logout on page refresh, only on actual close
            if (performance.navigation.type !== 1) {
                adminLogout();
            }
        });
    }
    
    // Logout function
    function adminLogout() {
        const currentModule = getCurrentModule();
        const sessionKey = `admin_session_${currentModule}`;
        
        // Clear session
        localStorage.removeItem(sessionKey);
        
        // Show success message
        if (typeof showAlert === 'function') {
            showAlert('Logged out successfully', 'success');
        }
        
        // Redirect to home
        setTimeout(() => {
            window.location.href = CONFIG.homeUrl;
        }, 1000);
    }
    
    // Setup session monitoring
    function setupSessionMonitoring() {
        // Check session every 30 seconds
        setInterval(function() {
            const currentModule = getCurrentModule();
            const sessionKey = `admin_session_${currentModule}`;
            const sessionData = localStorage.getItem(sessionKey);
            
            if (!sessionData) {
                redirectToHome('Session lost');
                return;
            }
            
            try {
                // Decrypt session data
                let session;
                try {
                    if (typeof securityUtils !== 'undefined' && securityUtils.decryptSessionData) {
                        session = securityUtils.decryptSessionData(sessionData, 'session-key');
                    } else {
                        session = JSON.parse(sessionData);
                    }
                } catch (decryptError) {
                    session = JSON.parse(sessionData);
                }
                
                const now = Date.now();
                
                if (now > session.expires) {
                    localStorage.removeItem(sessionKey);
                    redirectToHome('Session expired');
                    return;
                }
                
                // Warn when 10 minutes left
                const timeLeft = session.expires - now;
                if (timeLeft <= 10 * 60 * 1000 && timeLeft > 9 * 60 * 1000) {
                    if (typeof showAlert === 'function') {
                        showAlert('Session will expire in 10 minutes', 'warning');
                    }
                }
                
            } catch (error) {
                console.error('Session monitoring error:', error);
                localStorage.removeItem(sessionKey);
                redirectToHome('Session error');
            }
        }, 30000); // Check every 30 seconds
    }
    
    // Add security headers and protection
    function setupSecurity() {
        // Disable right-click context menu (optional security measure)
        document.addEventListener('contextmenu', function(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return true; // Allow context menu on form inputs
            }
            e.preventDefault();
            return false;
        });
        
        // Disable F12 and other developer shortcuts (optional)
        document.addEventListener('keydown', function(e) {
            // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
            if (e.key === 'F12' || 
                (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
                (e.ctrlKey && e.key === 'U')) {
                e.preventDefault();
                if (typeof showAlert === 'function') {
                    showAlert('Developer tools are disabled in admin panel', 'warning');
                }
                return false;
            }
        });
        
        // Add visual indicator for admin session
        addSessionIndicator();
    }
    
    // Add visual session indicator
    function addSessionIndicator() {
        const currentModule = getCurrentModule();
        const sessionKey = `admin_session_${currentModule}`;
        const sessionData = localStorage.getItem(sessionKey);
        
        if (sessionData) {
            try {
                // Decrypt session data
                let session;
                try {
                    if (typeof securityUtils !== 'undefined' && securityUtils.decryptSessionData) {
                        session = securityUtils.decryptSessionData(sessionData, 'session-key');
                    } else {
                        session = JSON.parse(sessionData);
                    }
                } catch (decryptError) {
                    session = JSON.parse(sessionData);
                }
                
                const indicator = document.createElement('div');
                indicator.id = 'adminSessionIndicator';
                indicator.style.cssText = `
                    position: fixed;
                    top: 10px;
                    left: 10px;
                    background: linear-gradient(135deg, #27ae60, #229954);
                    color: white;
                    padding: 8px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                    z-index: 9999;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                    user-select: none;
                `;
                
                const moduleNames = {
                    'main-operations': 'Main Admin',
                    'pin-management': 'PIN Admin',
                    'data-admin': 'Super Admin'
                };
                
                const moduleName = moduleNames[currentModule] || 'Admin';
                indicator.innerHTML = `🔐 ${moduleName} Session`;
                
                document.body.appendChild(indicator);
                
                // Update session timer
                updateSessionTimer(indicator, session);
                
            } catch (error) {
                console.error('Error adding session indicator:', error);
            }
        }
    }
    
    // Update session timer in indicator
    function updateSessionTimer(indicator, session) {
        const updateTimer = () => {
            const now = Date.now();
            const timeLeft = session.expires - now;
            
            if (timeLeft <= 0) {
                indicator.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
                indicator.innerHTML = '🔐 Session Expired';
                return;
            }
            
            const minutes = Math.floor(timeLeft / (1000 * 60));
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            
            let timeDisplay = '';
            if (hours > 0) {
                timeDisplay = `${hours}h ${remainingMinutes}m`;
            } else {
                timeDisplay = `${remainingMinutes}m`;
            }
            
            const moduleNames = {
                'main-operations': 'Main Admin',
                'pin-management': 'PIN Admin',
                'data-admin': 'Super Admin'
            };
            
            const currentModule = getCurrentModule();
            const moduleName = moduleNames[currentModule] || 'Admin';
            
            // Change color based on time left
            if (timeLeft <= 10 * 60 * 1000) { // 10 minutes
                indicator.style.background = 'linear-gradient(135deg, #f39c12, #e67e22)';
            } else if (timeLeft <= 30 * 60 * 1000) { // 30 minutes
                indicator.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
            } else {
                indicator.style.background = 'linear-gradient(135deg, #27ae60, #229954)';
            }
            
            indicator.innerHTML = `🔐 ${moduleName} (${timeDisplay})`;
        };
        
        updateTimer();
        setInterval(updateTimer, 60000); // Update every minute
    }
    
    // Initialize authentication check
    function init() {
        console.log('🔐 Initializing admin authentication...');
        console.log('🌐 Current URL:', window.location.href);
        console.log('📄 Current pathname:', window.location.pathname);
        
        // Check if we're on an admin page
        const currentModule = getCurrentModule();
        if (currentModule === 'unknown') {
            console.log('⚠️ Unknown module, skipping authentication');
            console.log('💡 If this is an admin page, you can:');
            console.log('  1. Add ?module=main-operations to URL for main operations');
            console.log('  2. Add ?module=pin-management to URL for PIN management');
            console.log('  3. Add ?module=data-admin to URL for data administration');
            console.log('  4. Or rename your file to: home.html, admin.html, or data-admin.html');
            return;
        }
        
        // Skip authentication for landing page
        if (currentModule === 'landing-page') {
            console.log('🏠 Landing page detected, no authentication required');
            return;
        }
        
        console.log('✅ Admin module identified:', currentModule);
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                performAuthCheck();
            });
        } else {
            performAuthCheck();
        }
    }
    
    function performAuthCheck() {
        // Check authentication
        if (!checkAuthentication()) {
            return; // Will redirect to home
        }
        
        // Setup logout and monitoring
        setupLogout();
        setupSessionMonitoring();
        setupSecurity();
        
        console.log('✅ Admin authentication setup complete');
    }
    
    // Expose logout function globally
    window.adminLogout = adminLogout;
    
    // Initialize
    init();
    
})();

// Utility function for admin pages to check specific permissions
function checkAdminPermission(requiredLevel) {
    const currentModule = getCurrentModule();
    const sessionKey = `admin_session_${currentModule}`;
    
    try {
        const sessionData = localStorage.getItem(sessionKey);
        if (!sessionData) return false;
        
        // Decrypt session data
        let session;
        try {
            if (typeof securityUtils !== 'undefined' && securityUtils.decryptSessionData) {
                session = securityUtils.decryptSessionData(sessionData, 'session-key');
            } else {
                session = JSON.parse(sessionData);
            }
        } catch (decryptError) {
            session = JSON.parse(sessionData);
        }
        
        // Check access level hierarchy
        const accessLevels = {
            'admin': 1,
            'super_admin': 2
        };
        
        const userLevel = accessLevels[session.accessLevel] || 0;
        const requiredLevelValue = accessLevels[requiredLevel] || 0;
        
        return userLevel >= requiredLevelValue;
        
    } catch (error) {
        console.error('Permission check error:', error);
        return false;
    }
}

// Helper function to get current module (duplicate for global access)
function getCurrentModule() {
    const modules = {
        'home.html': 'main-operations', // Main operations is now home.html
        'index.html': 'landing-page', // Landing page is now index.html
        'admin.html': 'pin-management', 
        'admin_pin_management.html': 'pin-management',
        'data-admin.html': 'data-admin',
        'data_deletion_tool.html': 'data-admin',
        'main.html': 'main-operations',
        'operations.html': 'main-operations',
        '': 'landing-page'
    };
    
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // Check direct mapping first
    if (modules[currentPage]) {
        return modules[currentPage];
    }
    
    // Check by document title or content if direct mapping fails
    if (typeof document !== 'undefined') {
        const title = document.title.toLowerCase();
        const bodyContent = document.body ? document.body.textContent.toLowerCase() : '';
        
        if (title.includes('pin management') || bodyContent.includes('pin management system')) {
            return 'pin-management';
        }
        
        if (title.includes('data deletion') || bodyContent.includes('data deletion tool')) {
            return 'data-admin';
        }
        
        if (title.includes('mini society') || bodyContent.includes('mini society management')) {
            return 'main-operations';
        }
        
        if (title.includes('society management system') && !bodyContent.includes('mini society')) {
            return 'landing-page';
        }
    }
    
    return 'unknown';
}

// Manual module override function (can be called from console or page)
function setAdminModule(moduleName) {
    console.log('🔧 Manually setting module to:', moduleName);
    window.adminModuleOverride = moduleName;
    
    // Re-initialize authentication
    if (typeof init === 'function') {
        init();
    } else {
        console.log('💡 Reload the page to apply authentication');
    }
}