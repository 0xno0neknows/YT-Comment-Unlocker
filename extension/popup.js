// Popup script for YouTube Comments Extension

document.addEventListener('DOMContentLoaded', async () => {
    const statusBar = document.getElementById('statusBar');
    const statusText = statusBar.querySelector('.status-text');
    const authSection = document.getElementById('authSection');
    const profileSection = document.getElementById('profileSection');
    const authTabBtns = document.querySelectorAll('.auth-tab-btn');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const copyIdBtn = document.getElementById('copyIdBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    // Form elements
    const loginFormEl = document.getElementById('loginFormEl');
    const registerFormEl = document.getElementById('registerFormEl');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');

    // Username validation elements
    const regUsername = document.getElementById('regUsername');
    const usernameStatus = document.getElementById('usernameStatus');

    let currentUser = null;
    let usernameCheckTimeout = null;
    let isUsernameValid = false;

    // Detect if running in incognito mode
    const isIncognito = chrome.extension.inIncognitoContext;

    // Check server health
    checkServerHealth();

    // Check if user is already logged in
    currentUser = await getCurrentUser();
    if (currentUser) {
        showProfile(currentUser);
    } else {
        showAuth();
    }

    // Auth tab switching
    authTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.authTab;
            switchAuthTab(tabId);
        });
    });

    // Profile tab switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            switchTab(tabId);
        });
    });

    // Real-time username validation
    regUsername.addEventListener('input', (e) => {
        const username = e.target.value.trim();

        // Clear previous timeout
        if (usernameCheckTimeout) {
            clearTimeout(usernameCheckTimeout);
        }

        // Reset status
        usernameStatus.className = 'username-status';
        usernameStatus.textContent = '';
        isUsernameValid = false;

        // Validate format locally first
        const usernameRegex = /^[a-zA-Z0-9]*$/;
        if (!usernameRegex.test(username)) {
            usernameStatus.className = 'username-status error';
            usernameStatus.textContent = '✗ Only letters and numbers allowed (a-z, A-Z, 0-9)';
            return;
        }

        if (username.length > 0 && username.length < 4) {
            usernameStatus.className = 'username-status error';
            usernameStatus.textContent = '✗ Minimum 4 characters required';
            return;
        }

        if (username.length >= 4) {
            usernameStatus.className = 'username-status checking';
            usernameStatus.textContent = '⏳ Checking availability...';

            // Debounce the API call
            usernameCheckTimeout = setTimeout(async () => {
                try {
                    const result = await chrome.runtime.sendMessage({
                        action: 'checkUsername',
                        username,
                        isIncognito
                    });

                    if (result.available) {
                        usernameStatus.className = 'username-status success';
                        usernameStatus.textContent = '✓ Username is available';
                        isUsernameValid = true;
                    } else {
                        usernameStatus.className = 'username-status error';
                        usernameStatus.textContent = `✗ ${result.error || 'Username is taken'}`;
                        isUsernameValid = false;
                    }
                } catch (error) {
                    usernameStatus.className = 'username-status error';
                    usernameStatus.textContent = '✗ Failed to check username';
                    isUsernameValid = false;
                }
            }, 500);
        }
    });

    // Login form submission
    loginFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const loginError = document.getElementById('loginError');

        loginError.textContent = '';
        loginError.classList.remove('show');

        if (!username || !password) {
            showFormError(loginError, 'Please fill in all fields');
            return;
        }

        loginBtn.disabled = true;
        loginBtn.classList.add('loading');

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'loginUser',
                username,
                password,
                isIncognito
            });

            if (response.error) {
                throw new Error(response.error);
            }

            currentUser = response;
            notifyContentScript(response);
            showProfile(response);

        } catch (error) {
            showFormError(loginError, error.message || 'Login failed');
        } finally {
            loginBtn.disabled = false;
            loginBtn.classList.remove('loading');
        }
    });

    // Register form submission
    registerFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('regUsername').value.trim();
        const password = document.getElementById('regPassword').value;
        const firstName = document.getElementById('regFirstName').value.trim();
        const lastName = document.getElementById('regLastName').value.trim();
        const registerError = document.getElementById('registerError');

        registerError.textContent = '';
        registerError.classList.remove('show');

        if (!username || !password || !firstName || !lastName) {
            showFormError(registerError, 'Please fill in all fields');
            return;
        }

        if (!isUsernameValid) {
            showFormError(registerError, 'Please choose a valid username');
            return;
        }

        if (password.length < 6) {
            showFormError(registerError, 'Password must be at least 6 characters');
            return;
        }

        registerBtn.disabled = true;
        registerBtn.classList.add('loading');

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'registerUser',
                username,
                password,
                firstName,
                lastName,
                isIncognito
            });

            if (response.error) {
                throw new Error(response.error);
            }

            currentUser = response;
            notifyContentScript(response);
            showProfile(response);

        } catch (error) {
            showFormError(registerError, error.message || 'Registration failed');
        } finally {
            registerBtn.disabled = false;
            registerBtn.classList.remove('loading');
        }
    });

    // Logout button
    logoutBtn.addEventListener('click', async () => {
        try {
            await chrome.runtime.sendMessage({
                action: 'logoutUser',
                isIncognito
            });

            currentUser = null;
            showAuth();

            // Notify content script
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'userLoggedOut' });
                }
            });
        } catch (error) {
            console.error('Logout failed:', error);
        }
    });

    // Copy ID button
    copyIdBtn.addEventListener('click', async () => {
        if (!currentUser) return;

        try {
            await navigator.clipboard.writeText(currentUser.id);
            copyIdBtn.classList.add('copied');
            setTimeout(() => {
                copyIdBtn.classList.remove('copied');
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    });

    // ============== FUNCTIONS ==============

    async function getCurrentUser() {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getCurrentUser',
                isIncognito
            });
            return response;
        } catch {
            return null;
        }
    }

    async function checkServerHealth() {
        try {
            const isHealthy = await chrome.runtime.sendMessage({ action: 'checkHealth' });

            if (isHealthy) {
                statusBar.classList.add('connected');
                statusBar.classList.remove('error');
                statusText.textContent = 'Connected to server';
            } else {
                throw new Error('Server not responding');
            }
        } catch {
            statusBar.classList.add('error');
            statusBar.classList.remove('connected');
            statusText.textContent = 'Server offline - Start the backend server';
        }
    }

    function showAuth() {
        authSection.classList.remove('hidden');
        profileSection.classList.add('hidden');
        // Reset forms
        loginFormEl.reset();
        registerFormEl.reset();
        usernameStatus.className = 'username-status';
        usernameStatus.textContent = '';
        document.getElementById('loginError').classList.remove('show');
        document.getElementById('registerError').classList.remove('show');
    }

    function showProfile(user) {
        authSection.classList.add('hidden');
        profileSection.classList.remove('hidden');

        // Update profile card
        document.getElementById('profileAvatar').textContent = getInitials(user.firstName, user.lastName);
        document.getElementById('profileName').textContent = `${user.firstName} ${user.lastName}`;
        document.getElementById('profileUsername').textContent = `@${user.username}`;

        // Update profile details
        document.getElementById('detailUsername').textContent = user.username;
        document.getElementById('detailFirstName').textContent = user.firstName;
        document.getElementById('detailLastName').textContent = user.lastName;
        document.getElementById('detailUserId').textContent = user.id;

        if (user.createdAt) {
            const date = new Date(user.createdAt);
            document.getElementById('detailCreatedAt').textContent = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        // Default to profile tab
        switchTab('profile');
    }

    function switchAuthTab(tabId) {
        authTabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.authTab === tabId);
        });

        document.querySelectorAll('.auth-form-container').forEach(form => {
            form.classList.remove('active');
        });

        document.getElementById(`${tabId}Form`).classList.add('active');
    }

    function switchTab(tabId) {
        tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        const activeTab = document.getElementById(`${tabId}Tab`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        if (tabId === 'comments' && currentUser) {
            loadUserComments();
        }
    }

    async function loadUserComments() {
        const container = document.getElementById('userCommentsContainer');
        const countEl = document.getElementById('userCommentCount');

        container.innerHTML = `
            <div class="loading-comments">
                <div class="spinner"></div>
                <span>Loading your comments...</span>
            </div>
        `;

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getUserComments',
                userId: currentUser.id,
                isIncognito
            });

            if (response.error) {
                throw new Error(response.error);
            }

            const { comments, commentCount } = response;
            countEl.textContent = `${commentCount} comment${commentCount !== 1 ? 's' : ''}`;

            if (comments.length === 0) {
                container.innerHTML = `
                    <div class="no-comments">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                        </svg>
                        <p>No comments yet</p>
                        <span>Visit a video with disabled comments to start!</span>
                    </div>
                `;
                return;
            }

            container.innerHTML = comments.map(comment => `
                <div class="user-comment-item">
                    <div class="comment-video-info">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z"/>
                        </svg>
                        <span class="comment-video-id" title="${comment.videoId}">Video: ${comment.videoId}</span>
                        <span class="comment-type-badge ${comment.isReply ? 'reply' : ''}">${comment.isReply ? 'Reply' : 'Comment'}</span>
                    </div>
                    <p class="comment-text">${escapeHtml(comment.content)}</p>
                    <div class="comment-footer-row">
                        <span class="comment-time">${getTimeAgo(new Date(comment.createdAt))}</span>
                        <button class="open-video-btn" data-video-id="${comment.videoId}" title="Open video">
                            <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                                <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                            </svg>
                            Open Video
                        </button>
                    </div>
                </div>
            `).join('');

            // Add click handlers for open video buttons
            container.querySelectorAll('.open-video-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const videoId = btn.dataset.videoId;
                    chrome.tabs.create({ url: `https://www.youtube.com/watch?v=${videoId}` });
                });
            });

        } catch (error) {
            console.error('Failed to load comments:', error);
            container.innerHTML = `
                <div class="no-comments">
                    <p>Failed to load comments</p>
                    <span>${error.message}</span>
                </div>
            `;
        }
    }

    function showFormError(element, message) {
        element.textContent = message;
        element.classList.add('show');
    }

    function getInitials(firstName, lastName) {
        return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
    }

    function getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);

        const intervals = {
            year: 31536000,
            month: 2592000,
            week: 604800,
            day: 86400,
            hour: 3600,
            minute: 60
        };

        for (const [unit, secondsInUnit] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / secondsInUnit);
            if (interval >= 1) {
                return `${interval} ${unit}${interval !== 1 ? 's' : ''} ago`;
            }
        }

        return 'Just now';
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function notifyContentScript(user) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url?.includes('youtube.com')) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'userRegistered',
                    user
                });
            }
        });
    }
});
