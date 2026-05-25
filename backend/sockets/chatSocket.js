const jwt = require('jsonwebtoken');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const {
  getOrCreateConversationForUser,
} = require('../controllers/chatController');

const ADMIN_ROOM = 'admins';
const userRoom = (userId) => `user:${userId}`;
const convoRoom = (convoId) => `convo:${convoId}`;

const initChatSocket = (io) => {
  // JWT auth middleware
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) return next(new Error('Auth token required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // { userId, role }
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const { userId, role } = socket.user;
    console.log(`[socket] connected user=${userId} role=${role}`);

    socket.join(userRoom(userId));
    if (role === 'admin') socket.join(ADMIN_ROOM);

    // Join a specific conversation room
    socket.on('chat:join', async ({ conversationId }, ack) => {
      try {
        let conversation;
        if (conversationId) {
          conversation = await Conversation.findById(conversationId);
        } else if (role !== 'admin') {
          conversation = await getOrCreateConversationForUser(userId);
        }
        if (!conversation) {
          return ack?.({ ok: false, error: 'Conversation not found' });
        }

        const isOwner = conversation.user.toString() === userId;
        if (!isOwner && role !== 'admin') {
          return ack?.({ ok: false, error: 'Forbidden' });
        }

        socket.join(convoRoom(conversation._id.toString()));
        ack?.({ ok: true, conversationId: conversation._id.toString() });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    socket.on('chat:leave', ({ conversationId }) => {
      if (conversationId) socket.leave(convoRoom(conversationId));
    });

    // Send a message
    socket.on('chat:send', async (payload, ack) => {
      try {
        const { conversationId, content } = payload || {};
        if (!content || !content.trim()) {
          return ack?.({ ok: false, error: 'Empty content' });
        }

        let conversation;
        if (conversationId) {
          conversation = await Conversation.findById(conversationId);
        } else if (role !== 'admin') {
          conversation = await getOrCreateConversationForUser(userId);
        }
        if (!conversation) {
          return ack?.({ ok: false, error: 'Conversation not found' });
        }

        const isOwner = conversation.user.toString() === userId;
        if (!isOwner && role !== 'admin') {
          return ack?.({ ok: false, error: 'Forbidden' });
        }

        const trimmed = content.trim().slice(0, 4000);
        const message = await Message.create({
          conversation: conversation._id,
          sender: userId,
          senderRole: role === 'admin' ? 'admin' : 'user',
          content: trimmed,
          readBy: [userId],
        });

        conversation.lastMessage = trimmed;
        conversation.lastMessageAt = new Date();
        conversation.lastSenderRole = role === 'admin' ? 'admin' : 'user';
        if (role === 'admin') conversation.unreadByUser += 1;
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

        // Emit to the conversation plus direct user/admin rooms so messages are
        // delivered even if one side has not joined the conversation room yet.
        io.to(convoRoom(conversation._id.toString()))
          .to(userRoom(conversation.user.toString()))
          .to(ADMIN_ROOM)
          .emit('chat:message', populated);

        // Notify admins list + the user so their list updates
        io.to(ADMIN_ROOM).emit('chat:conversation-updated', convoPopulated);
        io.to(userRoom(conversation.user.toString())).emit(
          'chat:conversation-updated',
          convoPopulated
        );

        ack?.({ ok: true, message: populated });
      } catch (err) {
        console.error('[socket] chat:send error', err);
        ack?.({ ok: false, error: err.message });
      }
    });

    // Mark conversation as read
    socket.on('chat:read', async ({ conversationId }, ack) => {
      try {
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return ack?.({ ok: false });
        const isOwner = conversation.user.toString() === userId;
        if (!isOwner && role !== 'admin') return ack?.({ ok: false });

        if (role === 'admin') conversation.unreadByAdmin = 0;
        else conversation.unreadByUser = 0;
        await conversation.save();

        const convoPopulated = await Conversation.findById(conversation._id).populate(
          'user',
          'name email'
        );
        io.to(ADMIN_ROOM).emit('chat:conversation-updated', convoPopulated);
        io.to(userRoom(conversation.user.toString())).emit(
          'chat:conversation-updated',
          convoPopulated
        );
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    // Typing indicator
    socket.on('chat:typing', ({ conversationId, isTyping }) => {
      if (!conversationId) return;
      socket.to(convoRoom(conversationId)).emit('chat:typing', {
        conversationId,
        userId,
        role,
        isTyping: !!isTyping,
      });
    });

    socket.on('disconnect', () => {
      console.log(`[socket] disconnected user=${userId}`);
    });
  });
};

module.exports = initChatSocket;
