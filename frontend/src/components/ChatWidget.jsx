import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, ChevronDown, Headphones } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { connectSocket, getSocket } from "../services/socket";

const formatTime = (d) => {
  const date = new Date(d);
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateLabel = (d) => {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Hôm nay";
  if (date.toDateString() === yesterday.toDateString()) return "Hôm qua";
  return date.toLocaleDateString("vi-VN");
};

const ChatWidget = () => {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [adminTyping, setAdminTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNewBadge, setShowNewBadge] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  const scrollRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const typingTimeoutRef = useRef(null);
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const checkIsNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    const threshold = 80;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };

  const scrollToBottom = (smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
    setShowNewBadge(false);
  };

  // Initialize: fetch conversation + messages
  const initChat = useCallback(async () => {
    if (!isAuthenticated || isAdmin) return;
    setLoading(true);
    try {
      const res = await api.getMyConversation();
      const convo = res.data || res;
      setConversation(convo);
      setUnreadCount(convo?.unreadByUser || 0);

      if (convo?._id) {
        const msgRes = await api.getConversationMessages(convo._id);
        const msgs = msgRes.data || msgRes || [];
        setMessages(Array.isArray(msgs) ? msgs : []);
      }
    } catch (err) {
      console.error("Chat init error:", err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isAdmin]);

  // Socket setup
  useEffect(() => {
    if (!isAuthenticated || isAdmin) return;
    const token = localStorage.getItem("token");
    const socket = connectSocket(token);
    if (!socket) return;

    initChat();

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);
    setSocketConnected(!!socket.connected);

    const onMessage = (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
      if (msg.senderRole === "admin") {
        if (!openRef.current || !isNearBottomRef.current) {
          setShowNewBadge(true);
          if (!openRef.current) setUnreadCount((c) => c + 1);
        }
      }
    };

    const onConvoUpdate = (convo) => {
      setConversation(convo);
      if (!openRef.current) setUnreadCount(convo?.unreadByUser || 0);
    };

    const onTyping = ({ role, isTyping }) => {
      if (role === "admin") setAdminTyping(!!isTyping);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("chat:message", onMessage);
    socket.on("chat:conversation-updated", onConvoUpdate);
    socket.on("chat:typing", onTyping);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("chat:message", onMessage);
      socket.off("chat:conversation-updated", onConvoUpdate);
      socket.off("chat:typing", onTyping);
    };
  }, [isAuthenticated, isAdmin, initChat]);

  // Join room when conversation available
  useEffect(() => {
    if (!conversation?._id) return;
    const socket = getSocket();
    if (!socket) return;
    socket.emit("chat:join", { conversationId: conversation._id });
    return () => {
      socket.emit("chat:leave", { conversationId: conversation._id });
    };
  }, [conversation?._id]);

  // Auto-scroll new messages if near bottom
  useEffect(() => {
    if (!open) return;
    if (isNearBottomRef.current) {
      scrollToBottom(true);
    }
  }, [messages, open]);

  // When opened, scroll to bottom & mark read
  useEffect(() => {
    if (open) {
      setTimeout(() => scrollToBottom(false), 50);
      setUnreadCount(0);
      setShowNewBadge(false);
      if (conversation?._id) {
        const socket = getSocket();
        socket?.emit("chat:read", { conversationId: conversation._id });
      }
    }
  }, [open, conversation?._id]);

  useEffect(() => {
    return () => {
      clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const handleScroll = () => {
    isNearBottomRef.current = checkIsNearBottom();
    if (isNearBottomRef.current) setShowNewBadge(false);
  };

  const handleSend = () => {
    const content = input.trim();
    if (!content || !conversation?._id) return;
    const socket = getSocket();
    if (!socket) return;

    socket.emit("chat:send", {
      conversationId: conversation._id,
      content,
    });
    setInput("");
    isNearBottomRef.current = true;
    setTimeout(() => scrollToBottom(true), 80);
  };

  const handleTyping = (val) => {
    setInput(val);
    const socket = getSocket();
    if (!socket || !conversation?._id) return;
    socket.emit("chat:typing", {
      conversationId: conversation._id,
      isTyping: true,
    });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("chat:typing", {
        conversationId: conversation._id,
        isTyping: false,
      });
    }, 1200);
  };

  if (!isAuthenticated || isAdmin) return null;

  // Group messages by day
  const groupedMessages = [];
  let lastDay = null;
  messages.forEach((m) => {
    const dayKey = new Date(m.createdAt).toDateString();
    if (dayKey !== lastDay) {
      groupedMessages.push({ type: "date", value: m.createdAt, id: `d-${dayKey}` });
      lastDay = dayKey;
    }
    groupedMessages.push({ type: "msg", value: m, id: m._id });
  });

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[60] group"
          aria-label="Mở chat hỗ trợ"
        >
          <div className="relative">
            <div className="w-14 h-14 bg-gradient-to-br from-[#FF385C] to-[#E31C5F] rounded-full shadow-lg shadow-rose-500/40 flex items-center justify-center text-white hover:scale-105 transition-transform cursor-pointer">
              <MessageCircle size={26} />
            </div>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
            <span className="absolute inset-0 rounded-full bg-rose-500/40 animate-ping opacity-60 pointer-events-none" />
          </div>
        </button>
      )}

      {/* Chat box */}
      {open && (
        <div className="fixed bottom-6 right-6 z-[60] w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-3rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#FF385C] to-[#E31C5F] text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Headphones size={20} />
              </div>
              <div>
                <div className="font-semibold text-sm">Hỗ trợ khách hàng</div>
                <div className="text-[11px] text-white/80 flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      socketConnected ? "bg-green-400" : "bg-white/50"
                    }`}
                  />
                  {socketConnected ? "Đang trực tuyến" : "Đang kết nối..."}
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 hover:bg-white/20 rounded-lg cursor-pointer"
              aria-label="Đóng"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-3 bg-gradient-to-b from-gray-50 to-white space-y-2 relative"
          >
            {loading ? (
              <div className="flex justify-center items-center h-full text-gray-400 text-sm">
                Đang tải...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-full text-center px-4">
                <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mb-3">
                  <MessageCircle size={28} className="text-[#FF385C]" />
                </div>
                <p className="font-semibold text-gray-800">Xin chào {user?.name}!</p>
                <p className="text-sm text-gray-500 mt-1">
                  Gửi tin nhắn cho chúng tôi. Đội ngũ hỗ trợ sẽ phản hồi sớm nhất.
                </p>
              </div>
            ) : (
              groupedMessages.map((item) => {
                if (item.type === "date") {
                  return (
                    <div key={item.id} className="flex justify-center my-3">
                      <span className="text-[11px] text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-100">
                        {formatDateLabel(item.value)}
                      </span>
                    </div>
                  );
                }
                const m = item.value;
                const mine = m.senderRole === "user";
                return (
                  <div
                    key={item.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                      {!mine && (
                        <span className="text-[10px] text-gray-400 mb-0.5 ml-2">
                          {m.sender?.name || "Hỗ trợ"}
                        </span>
                      )}
                      <div
                        className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                          mine
                            ? "bg-[#FF385C] text-white rounded-br-md"
                            : "bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm"
                        }`}
                      >
                        {m.content}
                      </div>
                      <span className="text-[10px] text-gray-400 mt-0.5 px-1">
                        {formatTime(m.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            {adminTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 px-3 py-2 rounded-2xl rounded-bl-md shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "120ms" }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "240ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* New messages badge */}
          {showNewBadge && (
            <button
              onClick={() => scrollToBottom(true)}
              className="absolute bottom-[74px] left-1/2 -translate-x-1/2 bg-[#FF385C] text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1 hover:bg-[#E31C5F] cursor-pointer z-10"
            >
              <ChevronDown size={14} /> Tin nhắn mới
            </button>
          )}

          {/* Input */}
          <div className="border-t border-gray-200 p-3 bg-white">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => handleTyping(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                placeholder="Nhập tin nhắn..."
                className="flex-1 resize-none max-h-24 px-3 py-2 text-sm bg-gray-100 border border-transparent focus:bg-white focus:border-[#FF385C] rounded-xl outline-none transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-[#FF385C] text-white disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-[#E31C5F] cursor-pointer transition-colors"
                aria-label="Gửi"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatWidget;
