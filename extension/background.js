// Background service worker for YouTube Comments Extension
const API_BASE = 'https://yt-comment-unlocker-production.up.railway.app/api';

// Helper to get the appropriate storage based on incognito status
function getStorage(isIncognito) {
    // Use session storage for incognito (cleared when browser closes)
    // Use local storage for normal windows (persisted)
    return isIncognito ? chrome.storage.session : chrome.storage.local;
}

// Get stored auth data
async function getAuthData(isIncognito) {
    const storage = getStorage(isIncognito);
    const result = await storage.get(['accessToken', 'refreshToken', 'user']);
    return result;
}

// Store auth data
async function storeAuthData(isIncognito, data) {
    const storage = getStorage(isIncognito);
    await storage.set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user
    });
}

// Clear auth data
async function clearAuthData(isIncognito) {
    const storage = getStorage(isIncognito);
    await storage.remove(['accessToken', 'refreshToken', 'user']);
}

// Refresh access token
async function refreshAccessToken(isIncognito) {
    const { refreshToken } = await getAuthData(isIncognito);

    if (!refreshToken) {
        throw new Error('No refresh token available');
    }

    const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
    });

    if (!response.ok) {
        // Refresh token is invalid/expired - clear auth and require re-login
        await clearAuthData(isIncognito);
        throw new Error('Session expired. Please login again.');
    }

    const data = await response.json();

    // Update stored access token and user
    const storage = getStorage(isIncognito);
    await storage.set({
        accessToken: data.accessToken,
        user: data.user
    });

    return data.accessToken;
}

// Make authenticated API request with auto-refresh
async function authenticatedFetch(url, options = {}, isIncognito) {
    let { accessToken } = await getAuthData(isIncognito);

    if (!accessToken) {
        throw new Error('Not logged in');
    }

    // Add auth header
    options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${accessToken}`
    };

    let response = await fetch(url, options);

    // If token expired, try to refresh and retry
    if (response.status === 401) {
        const errorData = await response.json();

        if (errorData.code === 'TOKEN_EXPIRED') {
            // Try to refresh token
            try {
                accessToken = await refreshAccessToken(isIncognito);

                // Retry with new token
                options.headers['Authorization'] = `Bearer ${accessToken}`;
                response = await fetch(url, options);
            } catch (refreshError) {
                throw new Error('Session expired. Please login again.');
            }
        }
    }

    return response;
}

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Determine incognito status from request (popup) or sender.tab (content script)
    const isIncognito = request.isIncognito ?? sender?.tab?.incognito ?? false;

    handleMessage(request, isIncognito)
        .then(sendResponse)
        .catch(error => sendResponse({ error: error.message }));

    // Return true to indicate async response
    return true;
});

async function handleMessage(request, isIncognito) {
    switch (request.action) {
        case 'checkUsername':
            return await checkUsername(request.username);

        case 'registerUser':
            return await registerUser(request.username, request.password, request.firstName, request.lastName, request.email, isIncognito);

        case 'loginUser':
            return await loginUser(request.username, request.password, isIncognito);

        case 'logoutUser':
            return await logoutUser(isIncognito);

        case 'getCurrentUser':
            return await getCurrentUser(isIncognito);

        case 'deleteAccount':
            return await deleteAccount(isIncognito);

        case 'getComments':
            return await getComments(request.videoId, request.sortBy, isIncognito);

        case 'deleteComment':
            return await deleteComment(request.commentId, isIncognito);

        case 'editComment':
            return await editComment(request.commentId, request.content, isIncognito);

        case 'voteComment':
            return await voteComment(request.commentId, request.voteType, isIncognito);

        case 'addComment':
            return await addComment(request.videoId, request.content, isIncognito);

        case 'addReply':
            return await addReply(request.commentId, request.content, isIncognito);

        case 'getUserComments':
            return await getUserComments(isIncognito);

        case 'checkHealth':
            return await checkHealth();

        default:
            throw new Error(`Unknown action: ${request.action}`);
    }
}

// Check username availability
async function checkUsername(username) {
    const response = await fetch(`${API_BASE}/auth/check-username/${encodeURIComponent(username)}`);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to check username');
    }

    return await response.json();
}

// Register a new user
async function registerUser(username, password, firstName, lastName, email, isIncognito) {
    const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, firstName, lastName, email: email || undefined })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to register user');
    }

    const data = await response.json();

    // Store auth data
    await storeAuthData(isIncognito, data);

    return data.user;
}

// Login user
async function loginUser(username, password, isIncognito) {
    const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();

    // Store auth data
    await storeAuthData(isIncognito, data);

    return data.user;
}

// Logout user
async function logoutUser(isIncognito) {
    const { refreshToken } = await getAuthData(isIncognito);

    // Invalidate refresh token on server
    if (refreshToken) {
        try {
            await fetch(`${API_BASE}/auth/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });
        } catch (e) {
            // Ignore errors, just clear local storage
        }
    }

    await clearAuthData(isIncognito);
    return { success: true };
}

// Get current logged-in user from storage
async function getCurrentUser(isIncognito) {
    const { user } = await getAuthData(isIncognito);
    return user || null;
}

// Delete user account
async function deleteAccount(isIncognito) {
    const response = await authenticatedFetch(`${API_BASE}/auth/account`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
    }, isIncognito);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete account');
    }

    await clearAuthData(isIncognito);
    return { success: true, message: 'Account deleted' };
}

// Get comments for a video
async function getComments(videoId, sortBy = 'newest', isIncognito) {
    const { user } = await getAuthData(isIncognito);
    let url = `${API_BASE}/videos/${encodeURIComponent(videoId)}/comments?sort=${encodeURIComponent(sortBy)}`;
    if (user) {
        url += `&userId=${encodeURIComponent(user.id)}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get comments');
    }

    return await response.json();
}

// Delete a comment
async function deleteComment(commentId, isIncognito) {
    const { user } = await getAuthData(isIncognito);

    const response = await authenticatedFetch(`${API_BASE}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
    }, isIncognito);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete comment');
    }

    return await response.json();
}

// Edit a comment
async function editComment(commentId, content, isIncognito) {
    const { user } = await getAuthData(isIncognito);

    const response = await authenticatedFetch(`${API_BASE}/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, content })
    }, isIncognito);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to edit comment');
    }

    return await response.json();
}

// Vote on a comment (like/dislike)
async function voteComment(commentId, voteType, isIncognito) {
    const { user } = await getAuthData(isIncognito);

    const response = await authenticatedFetch(`${API_BASE}/comments/${commentId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, voteType })
    }, isIncognito);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to vote on comment');
    }

    return await response.json();
}

// Add a comment to a video
async function addComment(videoId, content, isIncognito) {
    const { user } = await getAuthData(isIncognito);

    const response = await authenticatedFetch(`${API_BASE}/videos/${encodeURIComponent(videoId)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, content })
    }, isIncognito);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add comment');
    }

    return await response.json();
}

// Reply to a comment
async function addReply(commentId, content, isIncognito) {
    const { user } = await getAuthData(isIncognito);

    const response = await authenticatedFetch(`${API_BASE}/comments/${commentId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, content })
    }, isIncognito);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add reply');
    }

    return await response.json();
}

// Get all comments by current user
async function getUserComments(isIncognito) {
    const { user } = await getAuthData(isIncognito);

    if (!user) {
        throw new Error('Not logged in');
    }

    const response = await fetch(`${API_BASE}/users/${user.id}/comments`);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get user comments');
    }

    return await response.json();
}

// Check if server is available
async function checkHealth() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        return response.ok;
    } catch {
        return false;
    }
}

console.log('YouTube Comments Extension - Background service worker loaded');
