// Content script for YouTube Comments Extension
// Injects custom comments panel on videos with disabled comments

(function () {
    'use strict';

    const PANEL_ID = 'yt-comments-ext-panel';
    let currentVideoId = null;
    let currentUser = null;
    let checkInterval = null;
    let currentSortBy = 'newest'; // Sort options: newest, oldest, top

    // Initialize when page loads
    init();


    function init() {
        // Get current user from storage
        chrome.runtime.sendMessage({ action: 'getCurrentUser' }, (response) => {
            if (response && !response.error) {
                currentUser = response;
            }
        });

        // Start monitoring for disabled comments
        startMonitoring();

        // Listen for YouTube navigation (SPA)
        setupNavigationListener();

        // Watch for theme changes
        setupThemeObserver();
    }

    function setupThemeObserver() {
        // Watch for YouTube theme changes (dark attribute on html element)
        const htmlElement = document.documentElement;

        const themeObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.attributeName === 'dark') {
                    // Theme changed - the CSS handles this automatically via selectors
                    // but we can trigger any additional logic here if needed
                    console.log('[YT Comments Ext] Theme changed:', htmlElement.hasAttribute('dark') ? 'dark' : 'light');
                }
            }
        });

        themeObserver.observe(htmlElement, {
            attributes: true,
            attributeFilter: ['dark']
        });
    }

    function setupNavigationListener() {
        // YouTube is a SPA, so we need to detect navigation
        let lastUrl = location.href;

        const observer = new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                onNavigate();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    function onNavigate() {
        // Remove existing panel
        const existingPanel = document.getElementById(PANEL_ID);
        if (existingPanel) {
            existingPanel.remove();
        }

        // Reset video ID
        currentVideoId = null;

        // Check for disabled comments on new page
        if (location.pathname === '/watch') {
            setTimeout(startMonitoring, 1500);
        }
    }

    function startMonitoring() {
        // Clear any existing interval
        if (checkInterval) {
            clearInterval(checkInterval);
        }

        let attempts = 0;
        const maxAttempts = 20; // Check for 20 seconds

        checkInterval = setInterval(() => {
            attempts++;

            if (attempts > maxAttempts) {
                clearInterval(checkInterval);
                return;
            }

            if (areCommentsDisabled()) {
                clearInterval(checkInterval);
                injectCommentsPanel();
            }
        }, 1000);
    }

    function areCommentsDisabled() {
        // Method 1: Check for "Comments are turned off" message
        const messages = document.querySelectorAll('ytd-message-renderer, yt-formatted-string');
        for (const msg of messages) {
            const text = msg.textContent?.toLowerCase() || '';
            if (text.includes('comments are turned off') ||
                text.includes('comments are disabled') ||
                text.includes('comments have been turned off')) {
                return true;
            }
        }

        // Method 2: Check if comments section exists but is empty/disabled
        const commentsSection = document.querySelector('#comments');
        if (commentsSection) {
            const commentRenderer = commentsSection.querySelector('ytd-comments');
            if (commentRenderer) {
                const header = commentRenderer.querySelector('#header');
                const contents = commentRenderer.querySelector('#contents');

                // If there's no header or contents after loading, comments might be disabled
                if (!header && !contents) {
                    return true;
                }
            }
        }

        return false;
    }

    function getVideoId() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('v');
    }

    function injectCommentsPanel() {
        // Don't inject if already present
        if (document.getElementById(PANEL_ID)) {
            return;
        }

        currentVideoId = getVideoId();
        if (!currentVideoId) {
            return;
        }

        // Find the comments section or related videos section
        const commentsSection = document.querySelector('#comments');
        const relatedSection = document.querySelector('#related');
        const targetContainer = commentsSection || relatedSection?.parentElement;

        if (!targetContainer) {
            console.log('Could not find container for comments panel');
            return;
        }

        // Create and inject panel
        const panel = createCommentsPanel();

        if (commentsSection) {
            commentsSection.insertAdjacentElement('beforebegin', panel);
        } else {
            targetContainer.prepend(panel);
        }

        // Load comments
        loadComments();
    }

    function createCommentsPanel() {
        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.innerHTML = `
      <div class="yce-header">
        <div class="yce-header-left">
          <svg class="yce-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
          </svg>
          <h2 class="yce-title">Community Comments</h2>
          <span class="yce-badge">Extension</span>
        </div>
        <div class="yce-header-right">
          <span class="yce-comment-count">0 comments</span>
          <button class="yce-refresh-btn" title="Refresh comments">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
          </button>
          <div class="yce-sort-dropdown">
            <button class="yce-sort-btn">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/>
              </svg>
              <span class="yce-sort-label">Newest</span>
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M7 10l5 5 5-5z"/>
              </svg>
            </button>
            <div class="yce-sort-menu">
              <button class="yce-sort-option active" data-sort="newest">Newest first</button>
              <button class="yce-sort-option" data-sort="oldest">Oldest first</button>
              <button class="yce-sort-option" data-sort="top">Top comments</button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="yce-notice">
        <svg class="yce-notice-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
        <span>YouTube comments are disabled for this video. Share your thoughts using this community extension!</span>
      </div>

      <div class="yce-add-comment-section">
        ${currentUser ? `
          <div class="yce-user-avatar">${getInitials(currentUser.firstName, currentUser.lastName)}</div>
          <div class="yce-comment-input-wrapper">
            <textarea 
              class="yce-comment-input" 
              placeholder="Add a comment..." 
              rows="1"
            ></textarea>
            <div class="yce-comment-actions">
              <button class="yce-btn yce-btn-cancel">Cancel</button>
              <button class="yce-btn yce-btn-primary" disabled>Comment</button>
            </div>
          </div>
        ` : `
          <div class="yce-login-prompt">
            <p>Please register or login in the extension popup to add comments.</p>
            <button class="yce-btn yce-btn-primary yce-open-popup-btn">Open Extension</button>
          </div>
        `}
      </div>

      <div class="yce-comments-container">
        <div class="yce-loading">
          <div class="yce-spinner"></div>
          <span>Loading comments...</span>
        </div>
      </div>
    `;

        // Setup event listeners
        setupPanelEvents(panel);

        return panel;
    }

    function setupPanelEvents(panel) {
        const textarea = panel.querySelector('.yce-comment-input');
        const actions = panel.querySelector('.yce-comment-actions');
        const cancelBtn = panel.querySelector('.yce-btn-cancel');
        const submitBtn = panel.querySelector('.yce-btn-primary');
        const openPopupBtn = panel.querySelector('.yce-open-popup-btn');
        const refreshBtn = panel.querySelector('.yce-refresh-btn');

        // Refresh button click
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                refreshBtn.classList.add('spinning');
                refreshBtn.disabled = true;

                await loadComments();

                // Remove spinning after a short delay for visual feedback
                setTimeout(() => {
                    refreshBtn.classList.remove('spinning');
                    refreshBtn.disabled = false;
                }, 300);
            });
        }

        if (textarea) {
            // Auto-resize textarea
            textarea.addEventListener('input', () => {
                textarea.style.height = 'auto';
                textarea.style.height = textarea.scrollHeight + 'px';

                // Enable/disable submit button
                if (submitBtn) {
                    submitBtn.disabled = !textarea.value.trim();
                }
            });

            // Show actions on focus
            textarea.addEventListener('focus', () => {
                if (actions) actions.style.display = 'flex';
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                if (textarea) {
                    textarea.value = '';
                    textarea.style.height = 'auto';
                }
                if (actions) actions.style.display = 'none';
                if (submitBtn) submitBtn.disabled = true;
            });
        }

        if (submitBtn && textarea) {
            submitBtn.addEventListener('click', async () => {
                const content = textarea.value.trim();
                if (!content || !currentUser || !currentVideoId) return;

                submitBtn.disabled = true;
                submitBtn.textContent = 'Posting...';

                try {
                    await chrome.runtime.sendMessage({
                        action: 'addComment',
                        videoId: currentVideoId,
                        userId: currentUser.id,
                        content
                    });

                    textarea.value = '';
                    textarea.style.height = 'auto';
                    if (actions) actions.style.display = 'none';

                    // Reload comments
                    loadComments();
                } catch (error) {
                    console.error('Failed to add comment:', error);
                    alert('Failed to add comment. Please try again.');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Comment';
                }
            });
        }

        if (openPopupBtn) {
            openPopupBtn.addEventListener('click', () => {
                // Can't programmatically open popup, show message instead
                alert('Click the extension icon in your browser toolbar to register.');
            });
        }

        // Sort dropdown events
        const sortBtn = panel.querySelector('.yce-sort-btn');
        const sortMenu = panel.querySelector('.yce-sort-menu');
        const sortOptions = panel.querySelectorAll('.yce-sort-option');

        if (sortBtn && sortMenu) {
            sortBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                sortMenu.classList.toggle('visible');
            });

            // Close menu when clicking outside
            document.addEventListener('click', () => {
                sortMenu.classList.remove('visible');
            });

            sortOptions.forEach(option => {
                option.addEventListener('click', () => {
                    const newSort = option.dataset.sort;
                    if (newSort !== currentSortBy) {
                        currentSortBy = newSort;

                        // Update UI
                        sortOptions.forEach(o => o.classList.remove('active'));
                        option.classList.add('active');

                        // Update label
                        const label = panel.querySelector('.yce-sort-label');
                        if (label) {
                            const labels = { newest: 'Newest', oldest: 'Oldest', top: 'Top' };
                            label.textContent = labels[newSort] || 'Newest';
                        }

                        // Reload comments with new sort
                        loadComments();
                    }
                    sortMenu.classList.remove('visible');
                });
            });
        }
    }

    async function loadComments() {
        const container = document.querySelector('.yce-comments-container');
        const countEl = document.querySelector('.yce-comment-count');

        if (!container || !currentVideoId) return;

        container.innerHTML = `
      <div class="yce-loading">
        <div class="yce-spinner"></div>
        <span>Loading comments...</span>
      </div>
    `;

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getComments',
                videoId: currentVideoId,
                userId: currentUser?.id,
                sortBy: currentSortBy
            });

            if (response.error) {
                throw new Error(response.error);
            }

            const { comments, commentCount } = response;

            // Update count
            if (countEl) {
                const totalComments = countTotalComments(comments);
                countEl.textContent = `${totalComments} comment${totalComments !== 1 ? 's' : ''}`;
            }

            // Render comments
            if (comments.length === 0) {
                container.innerHTML = `
          <div class="yce-empty">
            <svg class="yce-empty-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
            </svg>
            <p>No comments yet</p>
            <span>Be the first to share your thoughts!</span>
          </div>
        `;
            } else {
                container.innerHTML = comments.map(comment => renderComment(comment)).join('');
                setupCommentEvents(container);
            }
        } catch (error) {
            console.error('Failed to load comments:', error);
            container.innerHTML = `
        <div class="yce-error">
          <p>Failed to load comments</p>
          <span>${error.message}</span>
          <button class="yce-btn yce-btn-primary yce-retry-btn">Retry</button>
        </div>
      `;

            const retryBtn = container.querySelector('.yce-retry-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', loadComments);
            }
        }
    }

    function countTotalComments(comments) {
        let count = comments.length;
        for (const comment of comments) {
            if (comment.replies) {
                count += countTotalComments(comment.replies);
            }
        }
        return count;
    }

    function renderComment(comment, isReply = false) {
        const timeAgo = getTimeAgo(new Date(comment.createdAt));
        const initials = getInitials(comment.author.firstName, comment.author.lastName);
        const fullName = `${comment.author.firstName} ${comment.author.lastName}`;
        const isOwner = currentUser && currentUser.id === comment.userId;
        const likeActive = comment.userVote === 1 ? 'active' : '';
        const dislikeActive = comment.userVote === -1 ? 'active' : '';

        // Check if within 1 hour edit window
        const oneHourMs = 60 * 60 * 1000;
        const timeSinceCreation = Date.now() - new Date(comment.createdAt).getTime();
        const canEdit = isOwner && timeSinceCreation < oneHourMs;

        // Check if comment was edited
        const isEdited = comment.updatedAt && new Date(comment.updatedAt) > new Date(comment.createdAt);

        return `
      <div class="yce-comment ${isReply ? 'yce-reply' : ''}" data-comment-id="${comment.id}" data-user-id="${comment.userId}" data-created-at="${comment.createdAt}">
        <div class="yce-comment-avatar">${initials}</div>
        <div class="yce-comment-content">
          <div class="yce-comment-header">
            <span class="yce-comment-author">${escapeHtml(fullName)}</span>
            <span class="yce-comment-time">${timeAgo}</span>
            ${isEdited ? '<span class="yce-edited-indicator">(edited)</span>' : ''}
            ${canEdit ? `
              <button class="yce-edit-btn" data-comment-id="${comment.id}" title="Edit comment">
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
              </button>
            ` : ''}
            ${isOwner ? `
              <button class="yce-delete-btn" data-comment-id="${comment.id}" title="Delete comment">
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
            ` : ''}
          </div>
          <p class="yce-comment-text">${escapeHtml(comment.content)}</p>
          <div class="yce-edit-form" style="display: none;">
            <textarea class="yce-edit-input">${escapeHtml(comment.content)}</textarea>
            <div class="yce-edit-actions">
              <button class="yce-btn yce-btn-cancel yce-cancel-edit">Cancel</button>
              <button class="yce-btn yce-btn-primary yce-save-edit" data-comment-id="${comment.id}">Save</button>
            </div>
          </div>
          <div class="yce-comment-footer">
            <button class="yce-vote-btn yce-like-btn ${likeActive}" data-comment-id="${comment.id}" data-vote="1">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>
              </svg>
              <span class="yce-vote-count">${comment.likes || 0}</span>
            </button>
            <button class="yce-vote-btn yce-dislike-btn ${dislikeActive}" data-comment-id="${comment.id}" data-vote="-1">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/>
              </svg>
              <span class="yce-vote-count">${comment.dislikes || 0}</span>
            </button>
            <button class="yce-reply-btn" data-comment-id="${comment.id}">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
              </svg>
              Reply
            </button>
          </div>
          <div class="yce-reply-form" style="display: none;">
            <textarea class="yce-reply-input" placeholder="Add a reply..." rows="1"></textarea>
            <div class="yce-reply-actions">
              <button class="yce-btn yce-btn-cancel yce-cancel-reply">Cancel</button>
              <button class="yce-btn yce-btn-primary yce-submit-reply" disabled>Reply</button>
            </div>
          </div>
          ${comment.replies && comment.replies.length > 0 ? `
            <div class="yce-replies">
              ${comment.replies.map(reply => renderComment(reply, true)).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
    }

    function setupCommentEvents(container) {
        // Delete button click
        container.querySelectorAll('.yce-delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const commentId = btn.dataset.commentId;

                if (!currentUser || !commentId) return;

                if (!confirm('Are you sure you want to delete this comment?')) {
                    return;
                }

                try {
                    await chrome.runtime.sendMessage({
                        action: 'deleteComment',
                        commentId,
                        userId: currentUser.id
                    });

                    // Reload comments
                    loadComments();
                } catch (error) {
                    console.error('Failed to delete comment:', error);
                    alert('Failed to delete comment. ' + error.message);
                }
            });
        });

        // Edit button click
        container.querySelectorAll('.yce-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const commentEl = btn.closest('.yce-comment');
                const textEl = commentEl.querySelector('.yce-comment-text');
                const editForm = commentEl.querySelector('.yce-edit-form');
                const footerEl = commentEl.querySelector('.yce-comment-footer');

                if (textEl && editForm) {
                    textEl.style.display = 'none';
                    editForm.style.display = 'block';
                    if (footerEl) footerEl.style.display = 'none';
                    editForm.querySelector('.yce-edit-input')?.focus();
                }
            });
        });

        // Cancel edit
        container.querySelectorAll('.yce-cancel-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const commentEl = btn.closest('.yce-comment');
                const textEl = commentEl.querySelector('.yce-comment-text');
                const editForm = commentEl.querySelector('.yce-edit-form');
                const footerEl = commentEl.querySelector('.yce-comment-footer');
                const editInput = editForm.querySelector('.yce-edit-input');

                if (textEl && editForm) {
                    // Reset input to original content
                    editInput.value = textEl.textContent;
                    textEl.style.display = 'block';
                    editForm.style.display = 'none';
                    if (footerEl) footerEl.style.display = 'flex';
                }
            });
        });

        // Save edit
        container.querySelectorAll('.yce-save-edit').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const commentId = btn.dataset.commentId;
                const commentEl = btn.closest('.yce-comment');
                const editInput = commentEl.querySelector('.yce-edit-input');
                const content = editInput?.value.trim();

                if (!currentUser || !commentId || !content) return;

                btn.disabled = true;
                btn.textContent = 'Saving...';

                try {
                    await chrome.runtime.sendMessage({
                        action: 'editComment',
                        commentId,
                        userId: currentUser.id,
                        content
                    });

                    // Reload comments to show updated content
                    loadComments();
                } catch (error) {
                    console.error('Failed to edit comment:', error);
                    alert('Failed to edit comment. ' + error.message);
                    btn.disabled = false;
                    btn.textContent = 'Save';
                }
            });
        });

        // Vote buttons (like/dislike)
        container.querySelectorAll('.yce-vote-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();

                if (!currentUser) {
                    alert('Please login in the extension popup to vote.');
                    return;
                }

                const commentId = btn.dataset.commentId;
                const voteType = parseInt(btn.dataset.vote);

                if (!commentId) return;

                // Disable button temporarily
                btn.disabled = true;

                try {
                    const response = await chrome.runtime.sendMessage({
                        action: 'voteComment',
                        commentId,
                        userId: currentUser.id,
                        voteType
                    });

                    // Update UI with new counts
                    const commentEl = btn.closest('.yce-comment');
                    const likeBtn = commentEl.querySelector('.yce-like-btn');
                    const dislikeBtn = commentEl.querySelector('.yce-dislike-btn');

                    if (likeBtn) {
                        likeBtn.querySelector('.yce-vote-count').textContent = response.likes;
                        likeBtn.classList.toggle('active', response.voteType === 1);
                    }
                    if (dislikeBtn) {
                        dislikeBtn.querySelector('.yce-vote-count').textContent = response.dislikes;
                        dislikeBtn.classList.toggle('active', response.voteType === -1);
                    }
                } catch (error) {
                    console.error('Failed to vote:', error);
                    alert('Failed to vote. ' + error.message);
                } finally {
                    btn.disabled = false;
                }
            });
        });

        // Reply button click
        container.querySelectorAll('.yce-reply-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (!currentUser) {
                    alert('Please register in the extension popup to reply.');
                    return;
                }

                const commentEl = e.target.closest('.yce-comment');
                const replyForm = commentEl.querySelector(':scope > .yce-comment-content > .yce-reply-form');

                if (replyForm) {
                    replyForm.style.display = 'block';
                    replyForm.querySelector('.yce-reply-input')?.focus();
                }
            });
        });

        // Cancel reply
        container.querySelectorAll('.yce-cancel-reply').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const replyForm = e.target.closest('.yce-reply-form');
                if (replyForm) {
                    replyForm.style.display = 'none';
                    const input = replyForm.querySelector('.yce-reply-input');
                    if (input) input.value = '';
                }
            });
        });

        // Reply input
        container.querySelectorAll('.yce-reply-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const submitBtn = e.target.closest('.yce-reply-form')?.querySelector('.yce-submit-reply');
                if (submitBtn) {
                    submitBtn.disabled = !e.target.value.trim();
                }
            });
        });

        // Submit reply
        container.querySelectorAll('.yce-submit-reply').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const replyForm = e.target.closest('.yce-reply-form');
                const commentEl = e.target.closest('.yce-comment');
                const input = replyForm?.querySelector('.yce-reply-input');
                const commentId = commentEl?.dataset.commentId;

                if (!input || !commentId || !currentUser) return;

                const content = input.value.trim();
                if (!content) return;

                btn.disabled = true;
                btn.textContent = 'Posting...';

                try {
                    await chrome.runtime.sendMessage({
                        action: 'addReply',
                        commentId,
                        userId: currentUser.id,
                        content
                    });

                    // Reload comments to show new reply
                    loadComments();
                } catch (error) {
                    console.error('Failed to add reply:', error);
                    alert('Failed to add reply. Please try again.');
                    btn.disabled = false;
                    btn.textContent = 'Reply';
                }
            });
        });
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

    // Listen for user updates from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'userRegistered') {
            currentUser = request.user;
            // Refresh the panel
            const panel = document.getElementById(PANEL_ID);
            if (panel) {
                panel.remove();
                injectCommentsPanel();
            }
        } else if (request.action === 'userLoggedOut') {
            currentUser = null;
            // Refresh the panel to show login prompt
            const panel = document.getElementById(PANEL_ID);
            if (panel) {
                panel.remove();
                injectCommentsPanel();
            }
        }
    });

})();
