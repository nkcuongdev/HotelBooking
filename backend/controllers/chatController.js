const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

const ADMIN_ROOM = 'admins';
const userRoom = (userId) => `user:${userId}`;
const convoRoom = (convoId) => `convo:${convoId}`;

// Helper: get or create conversation for a user
const getOrCreateConversationForUser = async (userId) => {
  let conversation = await Conversation.findOne({ user: userId });
  if (!conversation) {
    conversation = await Conversation.create({ user: userId });
  }
  return conversation;
};

// @desc    Get current user's conversation (user side)
// @route   GET /api/v1/chat/my-conversation
// @access  Private (user)
const getMyConversation = asyncHandler(async (req, res) => {
  const conversation = await getOrCreateConversationForUser(req.user.userId);
  const populated = await Conversation.findById(conversation._id).populate(
    'user',
    'name email'
  );
  res.json({ success: true, data: populated });
});

// @desc    Get messages in a conversation
// @route   GET /api/v1/chat/conversations/:id/messages
// @access  Private
const getMessages = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const conversation = await Conversation.findById(id);
  if (!conversation) {
    return res.status(404).json({ success: false, error: 'Conversation not found' });
  }

  // Authorization: user owns or is admin
  const isOwner = conversation.user.toString() === req.user.userId;
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  const messages = await Message.find({ conversation: id })
    .sort({ createdAt: 1 })
    .populate('sender', 'name email role');

  res.json({ success: true, data: messages });
});

// @desc    Send a message (REST fallback; primary path is socket)
// @route   POST /api/v1/chat/conversations/:id/messages
// @access  Private
const sendMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ success: false, error: 'Content required' });
  }

  const conversation = await Conversation.findById(id);
  if (!conversation) {
    return res.status(404).json({ success: false, error: 'Conversation not found' });
  }

  const isOwner = conversation.user.toString() === req.user.userId;
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  const message = await Message.create({
    conversation: conversation._id,
    sender: req.user.userId,
    senderRole: isAdmin ? 'admin' : 'user',
    content: content.trim(),
    readBy: [req.user.userId],
  });

  conversation.lastMessage = content.trim();
  conversation.lastMessageAt = new Date();
  conversation.lastSenderRole = isAdmin ? 'admin' : 'user';
  if (isAdmin) conversation.unreadByUser += 1;
  else conversation.unreadByAdmin += 1;
  await conversation.save();

  const populated = await Message.findById(message._id).populate(
    'sender',
    'name email role'
  );
  const convoPopulated = await Conversation.findById(conversation._id).populate(
    'user',
    'name email'
  );

  const io = req.app.get('io');
  if (io) {
    io.to(convoRoom(conversation._id.toString()))
      .to(userRoom(conversation.user.toString()))
      .to(ADMIN_ROOM)
      .emit('chat:message', populated);
    io.to(ADMIN_ROOM).emit('chat:conversation-updated', convoPopulated);
    io.to(userRoom(conversation.user.toString())).emit(
      'chat:conversation-updated',
      convoPopulated
    );
  }

  res.status(201).json({ success: true, data: populated });
});

// @desc    List all conversations (admin)
// @route   GET /api/v1/chat/conversations
// @access  Private (admin)
const listConversations = asyncHandler(async (req, res) => {
  const conversations = await Conversation.find()
    .populate('user', 'name email role')
    .sort({ lastMessageAt: -1 });
  res.json({ success: true, data: conversations });
});

// @desc    Mark conversation as read
// @route   PATCH /api/v1/chat/conversations/:id/read
// @access  Private
const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const conversation = await Conversation.findById(id);
  if (!conversation) {
    return res.status(404).json({ success: false, error: 'Conversation not found' });
  }

  const isOwner = conversation.user.toString() === req.user.userId;
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  if (isAdmin) conversation.unreadByAdmin = 0;
  else conversation.unreadByUser = 0;
  await conversation.save();

  res.json({ success: true, data: conversation });
});

module.exports = {
  getMyConversation,
  getMessages,
  sendMessage,
  listConversations,
  markAsRead,
  getOrCreateConversationForUser,
};
