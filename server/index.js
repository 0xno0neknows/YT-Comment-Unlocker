const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 10;

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS) || 7;

// ============== HELPER FUNCTIONS ==============

function generateAccessToken(user) {
    return jwt.sign(
        {
            userId: user.id,
            username: user.username
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

function generateRefreshToken() {
    return crypto.randomBytes(40).toString('hex');
}

async function createRefreshToken(userId) {
    const token = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
        data: {
            token,
            userId,
            expiresAt
        }
    });

    return { token, expiresAt };
}

// ============== JWT MIDDLEWARE ==============

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
            }
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = decoded;
        next();
    });
}

// Optional auth - doesn't fail if no token, but attaches user if present
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = null;
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        req.user = err ? null : decoded;
        next();
    });
}

// ============== RATE LIMITERS ==============

// General API rate limiter - 100 requests per minute per IP
const generalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false
});

// Strict limiter for login - 5 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: { error: 'Too many login attempts, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false
});

// Strict limiter for registration - 3 accounts per hour per IP
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: { error: 'Too many accounts created, please try again after an hour' },
    standardHeaders: true,
    legacyHeaders: false
});

// Comment posting limiter - 10 comments per minute per IP
const commentLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: { error: 'Too many comments, please slow down' },
    standardHeaders: true,
    legacyHeaders: false
});

// ============== MIDDLEWARE ==============
app.use(cors());
app.use(express.json());
app.use(generalLimiter); // Apply general limiter to all routes

// ============== AUTH ENDPOINTS ==============

// Check if username is available (real-time validation)
app.get('/api/auth/check-username/:username', async (req, res) => {
    try {
        const { username } = req.params;

        // Validate username format
        const usernameRegex = /^[a-zA-Z0-9]+$/;
        if (!usernameRegex.test(username)) {
            return res.json({
                available: false,
                error: 'Username can only contain letters and numbers (a-z, A-Z, 0-9)'
            });
        }

        if (username.length < 4) {
            return res.json({
                available: false,
                error: 'Username must be at least 4 characters'
            });
        }

        // Check if username exists
        const existingUser = await prisma.user.findFirst({
            where: { username: { equals: username, mode: 'insensitive' } }
        });

        res.json({
            available: !existingUser,
            error: existingUser ? 'Username is already taken' : null
        });
    } catch (error) {
        console.error('Error checking username:', error);
        res.status(500).json({ available: false, error: 'Failed to check username' });
    }
});

// Register a new user
app.post('/api/auth/register', registerLimiter, async (req, res) => {
    try {
        const { username, password, firstName, lastName, email } = req.body;

        // Validate required fields
        if (!username || !password || !firstName || !lastName) {
            return res.status(400).json({
                error: 'Username, password, first name, and last name are required'
            });
        }

        // Validate username format (alphanumeric only - prevents injection)
        const usernameRegex = /^[a-zA-Z0-9]+$/;
        if (!usernameRegex.test(username)) {
            return res.status(400).json({
                error: 'Username can only contain letters and numbers (a-z, A-Z, 0-9)'
            });
        }

        if (username.length < 4 || username.length > 20) {
            return res.status(400).json({
                error: 'Username must be between 4 and 20 characters'
            });
        }

        // Validate password length
        if (password.length < 6 || password.length > 32) {
            return res.status(400).json({
                error: 'Password must be between 6 and 32 characters'
            });
        }

        // Validate email format if provided
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    error: 'Invalid email format'
                });
            }

            // Check if email already exists
            const existingEmail = await prisma.user.findUnique({
                where: { email: email.toLowerCase() }
            });
            if (existingEmail) {
                return res.status(409).json({ error: 'Email is already registered' });
            }
        }

        // Check if username exists
        const existingUser = await prisma.user.findFirst({
            where: { username: { equals: username, mode: 'insensitive' } }
        });

        if (existingUser) {
            return res.status(409).json({ error: 'Username is already taken' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Create user
        const user = await prisma.user.create({
            data: {
                username: username.trim(),
                password: hashedPassword,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email ? email.toLowerCase().trim() : null
            }
        });

        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = await createRefreshToken(user.id);

        res.status(201).json({
            user: {
                id: user.id,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                emailVerified: user.emailVerified,
                createdAt: user.createdAt
            },
            accessToken,
            refreshToken: refreshToken.token,
            message: 'User registered successfully'
        });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

// Login user
app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                error: 'Username and password are required'
            });
        }

        // Find user by username
        const user = await prisma.user.findFirst({
            where: { username: { equals: username, mode: 'insensitive' } }
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Compare passwords
        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = await createRefreshToken(user.id);

        res.json({
            user: {
                id: user.id,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                emailVerified: user.emailVerified,
                createdAt: user.createdAt
            },
            accessToken,
            refreshToken: refreshToken.token,
            message: 'Login successful'
        });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});

// Refresh access token
app.post('/api/auth/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token required' });
        }

        // Find the refresh token
        const storedToken = await prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: true }
        });

        if (!storedToken) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        // Check if token is expired
        if (new Date() > storedToken.expiresAt) {
            // Delete expired token
            await prisma.refreshToken.delete({ where: { id: storedToken.id } });
            return res.status(401).json({ error: 'Refresh token expired' });
        }

        // Generate new access token
        const accessToken = generateAccessToken(storedToken.user);

        res.json({
            accessToken,
            user: {
                id: storedToken.user.id,
                username: storedToken.user.username,
                firstName: storedToken.user.firstName,
                lastName: storedToken.user.lastName,
                email: storedToken.user.email,
                emailVerified: storedToken.user.emailVerified,
                createdAt: storedToken.user.createdAt
            }
        });
    } catch (error) {
        console.error('Error refreshing token:', error);
        res.status(500).json({ error: 'Failed to refresh token' });
    }
});

// Logout - invalidate refresh token
app.post('/api/auth/logout', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (refreshToken) {
            // Delete the refresh token
            await prisma.refreshToken.deleteMany({
                where: { token: refreshToken }
            });
        }

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Error logging out:', error);
        res.status(500).json({ error: 'Failed to logout' });
    }
});

// Get current user from token
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                email: true,
                emailVerified: true,
                createdAt: true
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Delete user account
app.delete('/api/auth/account', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Delete user (cascades to comments, votes, refresh tokens)
        await prisma.user.delete({
            where: { id: userId }
        });

        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

// ============== USER ENDPOINTS ==============

// Get user by ID
app.get('/api/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                createdAt: true
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// ============== COMMENT ENDPOINTS ==============

// Get all comments for a video
app.get('/api/videos/:videoId/comments', async (req, res) => {
    try {
        const { videoId } = req.params;
        const { userId, sort = 'newest' } = req.query; // sort: newest, oldest, top

        // Get all comments with user info and vote counts
        const comments = await prisma.comment.findMany({
            where: { videoId },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        username: true
                    }
                },
                votes: true
            },
            orderBy: { createdAt: 'asc' } // Always fetch in order, sort later for top
        });

        // Organize into tree structure
        const commentMap = new Map();
        const topLevelComments = [];

        // First pass: create comment objects with vote counts
        comments.forEach(comment => {
            const likes = comment.votes.filter(v => v.voteType === 1).length;
            const dislikes = comment.votes.filter(v => v.voteType === -1).length;
            const userVote = userId ? comment.votes.find(v => v.userId === userId)?.voteType || 0 : 0;

            commentMap.set(comment.id, {
                id: comment.id,
                videoId: comment.videoId,
                userId: comment.userId,
                content: comment.content,
                parentId: comment.parentId,
                createdAt: comment.createdAt,
                updatedAt: comment.updatedAt,
                author: {
                    firstName: comment.user.firstName,
                    lastName: comment.user.lastName,
                    username: comment.user.username
                },
                likes,
                dislikes,
                userVote, // 1 = liked, -1 = disliked, 0 = no vote
                replies: []
            });
        });

        // Second pass: build tree
        comments.forEach(comment => {
            const commentObj = commentMap.get(comment.id);
            if (comment.parentId) {
                const parent = commentMap.get(comment.parentId);
                if (parent) {
                    parent.replies.push(commentObj);
                }
            } else {
                topLevelComments.push(commentObj);
            }
        });

        // Sort top-level comments based on sort parameter
        if (sort === 'newest') {
            topLevelComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else if (sort === 'oldest') {
            topLevelComments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        } else if (sort === 'top') {
            topLevelComments.sort((a, b) => b.likes - a.likes);
        }

        res.json({
            videoId,
            commentCount: topLevelComments.length,
            comments: topLevelComments
        });
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

// Add a new comment to a video
app.post('/api/videos/:videoId/comments', commentLimiter, async (req, res) => {
    try {
        const { videoId } = req.params;
        const { userId, content } = req.body;

        if (!userId || !content) {
            return res.status(400).json({
                error: 'User ID and content are required'
            });
        }

        // Verify user exists
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Create comment
        const comment = await prisma.comment.create({
            data: {
                videoId,
                userId,
                content: content.trim()
            }
        });

        res.status(201).json({
            id: comment.id,
            videoId: comment.videoId,
            userId: comment.userId,
            content: comment.content,
            parentId: null,
            createdAt: comment.createdAt,
            author: {
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username
            },
            replies: []
        });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// Reply to a comment
app.post('/api/comments/:commentId/replies', commentLimiter, async (req, res) => {
    try {
        const { commentId } = req.params;
        const { userId, content } = req.body;

        if (!userId || !content) {
            return res.status(400).json({
                error: 'User ID and content are required'
            });
        }

        // Verify parent comment exists
        const parentComment = await prisma.comment.findUnique({
            where: { id: commentId }
        });

        if (!parentComment) {
            return res.status(404).json({ error: 'Parent comment not found' });
        }

        // Verify user exists
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Create reply
        const reply = await prisma.comment.create({
            data: {
                videoId: parentComment.videoId,
                userId,
                content: content.trim(),
                parentId: commentId
            }
        });

        res.status(201).json({
            id: reply.id,
            videoId: reply.videoId,
            userId: reply.userId,
            content: reply.content,
            parentId: reply.parentId,
            createdAt: reply.createdAt,
            author: {
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username
            },
            replies: []
        });
    } catch (error) {
        console.error('Error adding reply:', error);
        res.status(500).json({ error: 'Failed to add reply' });
    }
});

// Get all comments by a user
app.get('/api/users/:userId/comments', async (req, res) => {
    try {
        const { userId } = req.params;

        // Verify user exists
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get all comments by this user
        const comments = await prisma.comment.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });

        const formattedComments = comments.map(comment => ({
            id: comment.id,
            videoId: comment.videoId,
            content: comment.content,
            parentId: comment.parentId,
            createdAt: comment.createdAt,
            isReply: comment.parentId !== null
        }));

        res.json({
            userId,
            commentCount: comments.length,
            comments: formattedComments
        });
    } catch (error) {
        console.error('Error fetching user comments:', error);
        res.status(500).json({ error: 'Failed to fetch user comments' });
    }
});

// Delete a comment (owner only)
app.delete('/api/comments/:commentId', async (req, res) => {
    try {
        const { commentId } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        // Find the comment
        const comment = await prisma.comment.findUnique({
            where: { id: commentId }
        });

        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        // Check ownership
        if (comment.userId !== userId) {
            return res.status(403).json({ error: 'You can only delete your own comments' });
        }

        // Delete the comment (cascades to replies and votes)
        await prisma.comment.delete({
            where: { id: commentId }
        });

        res.json({ success: true, message: 'Comment deleted' });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

// Edit a comment (owner only, within 1 hour of creation)
app.put('/api/comments/:commentId', async (req, res) => {
    try {
        const { commentId } = req.params;
        const { userId, content } = req.body;

        if (!userId || !content) {
            return res.status(400).json({ error: 'User ID and content are required' });
        }

        // Find the comment
        const comment = await prisma.comment.findUnique({
            where: { id: commentId }
        });

        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        // Check ownership
        if (comment.userId !== userId) {
            return res.status(403).json({ error: 'You can only edit your own comments' });
        }

        // Check if within 1 hour edit window
        const oneHourMs = 60 * 60 * 1000; // 1 hour in milliseconds
        const timeSinceCreation = Date.now() - new Date(comment.createdAt).getTime();

        if (timeSinceCreation > oneHourMs) {
            return res.status(403).json({
                error: 'Comments can only be edited within 1 hour of posting',
                editWindowExpired: true
            });
        }

        // Update the comment
        const updatedComment = await prisma.comment.update({
            where: { id: commentId },
            data: {
                content: content.trim(),
                updatedAt: new Date()
            },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        username: true
                    }
                }
            }
        });

        res.json({
            id: updatedComment.id,
            videoId: updatedComment.videoId,
            userId: updatedComment.userId,
            content: updatedComment.content,
            parentId: updatedComment.parentId,
            createdAt: updatedComment.createdAt,
            updatedAt: updatedComment.updatedAt,
            author: {
                firstName: updatedComment.user.firstName,
                lastName: updatedComment.user.lastName,
                username: updatedComment.user.username
            },
            message: 'Comment updated successfully'
        });
    } catch (error) {
        console.error('Error editing comment:', error);
        res.status(500).json({ error: 'Failed to edit comment' });
    }
});

// Vote on a comment (like/dislike)
app.post('/api/comments/:commentId/vote', async (req, res) => {
    try {
        const { commentId } = req.params;
        const { userId, voteType } = req.body; // voteType: 1 = like, -1 = dislike

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        if (voteType !== 1 && voteType !== -1) {
            return res.status(400).json({ error: 'Vote type must be 1 (like) or -1 (dislike)' });
        }

        // Check if comment exists
        const comment = await prisma.comment.findUnique({
            where: { id: commentId }
        });

        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        // Check for existing vote
        const existingVote = await prisma.commentVote.findUnique({
            where: {
                userId_commentId: { userId, commentId }
            }
        });

        let result;

        if (existingVote) {
            if (existingVote.voteType === voteType) {
                // Same vote type - remove the vote (toggle off)
                await prisma.commentVote.delete({
                    where: { id: existingVote.id }
                });
                result = { action: 'removed', voteType: 0 };
            } else {
                // Different vote type - update the vote
                await prisma.commentVote.update({
                    where: { id: existingVote.id },
                    data: { voteType }
                });
                result = { action: 'updated', voteType };
            }
        } else {
            // No existing vote - create new vote
            await prisma.commentVote.create({
                data: { userId, commentId, voteType }
            });
            result = { action: 'created', voteType };
        }

        // Get updated counts
        const votes = await prisma.commentVote.findMany({
            where: { commentId }
        });

        const likes = votes.filter(v => v.voteType === 1).length;
        const dislikes = votes.filter(v => v.voteType === -1).length;

        res.json({
            success: true,
            ...result,
            likes,
            dislikes
        });
    } catch (error) {
        console.error('Error voting on comment:', error);
        res.status(500).json({ error: 'Failed to vote on comment' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
async function startServer() {
    try {
        // Test database connection
        await prisma.$connect();
        console.log('📦 Connected to PostgreSQL database');

        app.listen(PORT, () => {
            console.log(`🚀 YouTube Comments Server running on http://localhost:${PORT}`);
            console.log(`📝 API endpoints:`);
            console.log(`   GET  /api/auth/check-username/:username - Check username availability`);
            console.log(`   POST /api/auth/register - Register user`);
            console.log(`   POST /api/auth/login - Login user`);
            console.log(`   GET  /api/users/:userId - Get user`);
            console.log(`   GET  /api/videos/:videoId/comments - Get comments`);
            console.log(`   POST /api/videos/:videoId/comments - Add comment`);
            console.log(`   POST /api/comments/:commentId/replies - Reply to comment`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('beforeExit', async () => {
    await prisma.$disconnect();
});

startServer();
