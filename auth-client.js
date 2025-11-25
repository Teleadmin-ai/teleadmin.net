/**
 * Teleadmin Auth Client
 * =====================
 * Include this script on cognition4chat.com, cyberplace.ai, cognition4ai.com
 * to enable SSO (Single Sign-On) with teleadmin.net
 *
 * Usage:
 *   <script src="https://teleadmin.net/auth-client.js"></script>
 *   <script>
 *       TeleadminAuth.init().then(auth => {
 *           if (auth.authenticated) {
 *               console.log('Logged in as', auth.user.login);
 *           }
 *       });
 *   </script>
 */

(function(window) {
    'use strict';

    const AUTH_BRIDGE_URL = 'https://teleadmin.net/auth-bridge.html';
    const AUTH_ORIGIN = 'https://teleadmin.net';
    const LOGIN_URL = 'https://teleadmin.net/?login=1';

    let bridgeFrame = null;
    let bridgeReady = false;
    let pendingRequests = [];

    const TeleadminAuth = {
        /**
         * Initialize the auth client
         * @returns {Promise<{authenticated: boolean, user?: object, token?: string, profile?: object}>}
         */
        init: function() {
            return new Promise((resolve) => {
                // Create invisible iframe
                bridgeFrame = document.createElement('iframe');
                bridgeFrame.id = 'teleadmin-auth-bridge';
                bridgeFrame.src = AUTH_BRIDGE_URL;
                bridgeFrame.style.display = 'none';
                document.body.appendChild(bridgeFrame);

                // Listen for messages
                window.addEventListener('message', handleMessage);

                // Wait for bridge ready, then get auth
                const checkReady = setInterval(() => {
                    if (bridgeReady) {
                        clearInterval(checkReady);
                        TeleadminAuth.getAuth().then(resolve);
                    }
                }, 100);

                // Timeout after 5 seconds
                setTimeout(() => {
                    clearInterval(checkReady);
                    if (!bridgeReady) {
                        resolve({ authenticated: false, error: 'Bridge timeout' });
                    }
                }, 5000);
            });
        },

        /**
         * Get current auth state
         * @returns {Promise<{authenticated: boolean, user?: object, token?: string, profile?: object}>}
         */
        getAuth: function() {
            return sendMessage({ type: 'get-auth' }, 'auth-response');
        },

        /**
         * Redirect to login page
         * @param {string} returnUrl - URL to return to after login
         */
        login: function(returnUrl) {
            const url = new URL(LOGIN_URL);
            url.searchParams.set('return', returnUrl || window.location.href);
            window.location.href = url.toString();
        },

        /**
         * Logout and clear auth on all sites
         * @returns {Promise<{success: boolean}>}
         */
        logout: function() {
            // Clear local storage
            localStorage.removeItem('github_token');
            localStorage.removeItem('github_user');
            localStorage.removeItem('user_profile');

            // Clear on teleadmin.net
            return sendMessage({ type: 'clear-auth' }, 'auth-clear-response');
        },

        /**
         * Check if user is authenticated
         * @returns {boolean}
         */
        isAuthenticated: function() {
            return !!localStorage.getItem('github_token');
        },

        /**
         * Get current user from local storage
         * @returns {object|null}
         */
        getUser: function() {
            const userStr = localStorage.getItem('github_user');
            return userStr ? JSON.parse(userStr) : null;
        },

        /**
         * Get API token from local storage
         * @returns {string|null}
         */
        getToken: function() {
            return localStorage.getItem('github_token');
        }
    };

    function handleMessage(event) {
        // Only accept messages from teleadmin.net
        if (event.origin !== AUTH_ORIGIN) return;

        const data = event.data;

        if (data.type === 'auth-bridge-ready') {
            bridgeReady = true;
            // Process pending requests
            pendingRequests.forEach(req => {
                bridgeFrame.contentWindow.postMessage(req.message, AUTH_ORIGIN);
            });
            return;
        }

        // Store auth locally if authenticated
        if (data.type === 'auth-response' && data.authenticated) {
            localStorage.setItem('github_token', data.token);
            localStorage.setItem('github_user', JSON.stringify(data.user));
            if (data.profile) {
                localStorage.setItem('user_profile', JSON.stringify(data.profile));
            }
        }

        // Resolve pending request
        const reqIndex = pendingRequests.findIndex(r => r.responseType === data.type);
        if (reqIndex !== -1) {
            pendingRequests[reqIndex].resolve(data);
            pendingRequests.splice(reqIndex, 1);
        }
    }

    function sendMessage(message, responseType) {
        return new Promise((resolve) => {
            pendingRequests.push({ message, responseType, resolve });

            if (bridgeReady && bridgeFrame) {
                bridgeFrame.contentWindow.postMessage(message, AUTH_ORIGIN);
            }
            // If not ready, will be sent when bridge becomes ready
        });
    }

    // Expose globally
    window.TeleadminAuth = TeleadminAuth;

})(window);
