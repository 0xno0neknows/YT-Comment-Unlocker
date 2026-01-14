// Background service worker for YouTube Comments Extension
const API_BASE = 'https://yt-comment-unlocker-production.up.railway.app/api';

// Helper to get the appropriate storage based on incognito status
function getStorage(isIncognito) {
    // Use session storage for incognito (cleared when browser closes)
    // Use local storage for normal windows (persisted)
    return isIncognito ? chrome.storage.session : chrome.storage.local;
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
            return await registerUser(request.username, request.password, request.firstName, request.lastName, isIncognito);

        case 'loginUser':
            return await loginUser(request.username, request.password, isIncognito);

        case 'logoutUser':
            return await logoutUser(isIncognito);

        case 'getUser':
            return await getUser(request.userId);

        case 'getCurrentUser':
            return await getCurrentUser(isIncognito);

        case 'getComments':
            return await getComments(request.videoId, request.userId, request.sortBy);

        case 'deleteComment':
            return await deleteComment(request.commentId, request.userId);

        case 'editComment':
            return await editComment(request.commentId, request.userId, request.content);

        case 'voteComment':
            return await voteComment(request.commentId, request.userId, request.voteType);

        case 'addComment':
            return await addComment(request.videoId, request.userId, request.content);

        case 'addReply':
            return await addReply(request.commentId, request.userId, request.content);

        case 'getUserComments':
            return await getUserComments(request.userId);

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
async function registerUser(username, password, firstName, lastName, isIncognito) {
    const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, firstName, lastName })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to register user');
    }

    const user = await response.json();

    // Store user in appropriate storage (session for incognito, local for normal)
    const storage = getStorage(isIncognito);
    await storage.set({ user });

    return user;
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

    const user = await response.json();

    // Store user in appropriate storage
    const storage = getStorage(isIncognito);
    await storage.set({ user });

    return user;
}

// Logout user
async function logoutUser(isIncognito) {
    const storage = getStorage(isIncognito);
    await storage.remove('user');
    return { success: true };
}

// Get user by ID
async function getUser(userId) {
    const response = await fetch(`${API_BASE}/users/${userId}`);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get user');
    }

    return await response.json();
}

// Get current logged-in user from storage
async function getCurrentUser(isIncognito) {
    const storage = getStorage(isIncognito);
    const result = await storage.get('user');
    return result.user || null;
}

// Get comments for a video
async function getComments(videoId, userId, sortBy = 'newest') {
    let url = `${API_BASE}/videos/${encodeURIComponent(videoId)}/comments?sort=${encodeURIComponent(sortBy)}`;
    if (userId) {
        url += `&userId=${encodeURIComponent(userId)}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get comments');
    }

    return await response.json();
}

// Delete a comment
async function deleteComment(commentId, userId) {
    const response = await fetch(`${API_BASE}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete comment');
    }

    return await response.json();
}

// Edit a comment
async function editComment(commentId, userId, content) {
    const response = await fetch(`${API_BASE}/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, content })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to edit comment');
    }

    return await response.json();
}

// Vote on a comment (like/dislike)
async function voteComment(commentId, userId, voteType) {
    const response = await fetch(`${API_BASE}/comments/${commentId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, voteType })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to vote on comment');
    }

    return await response.json();
}

// Add a comment to a video
async function addComment(videoId, userId, content) {
    const response = await fetch(`${API_BASE}/videos/${encodeURIComponent(videoId)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, content })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add comment');
    }

    return await response.json();
}

// Reply to a comment
async function addReply(commentId, userId, content) {
    const response = await fetch(`${API_BASE}/comments/${commentId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, content })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add reply');
    }

    return await response.json();
}

// Get all comments by a user
async function getUserComments(userId) {
    const response = await fetch(`${API_BASE}/users/${userId}/comments`);

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
