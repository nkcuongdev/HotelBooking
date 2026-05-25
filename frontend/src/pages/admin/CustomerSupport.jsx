import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Send, ChevronDown, MessageCircle, User as UserIcon } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import { connectSocket, getSocket } from "../../services/socket";

const formatTime = (d) => {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatRelative = (d) => {
  if (!d) return "";
  const now = new Date();
  const date = new Date(d);
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  if (diffMin < 1) return "Vừa xong";
  if (diffMin < 60) return `${diffMin} phút`;
  if (diffHour < 24) return `${diffHour} giờ`;
  if (diffDay < 7) return `${diffDay} ngày`;
  return date.toLocaleDateString("vi-VN");
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

const CustomerSupport = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [userTyping, setUserTyping] = useState(false);
  const [showNewBadge, setShowNewBadge] = useState(false);

  const scrollRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const typingTimeoutRef = useRef(null);
  const activeIdRef = useRef(null);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.listConversations();
      const list = res.data || res || [];
      setConversations(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Load conversations error:", err);
    }
  }, []);

  const loadMessages = useCallback(async (convoId) => {
    if (!convoId) return;
    setLoadingMsgs(true);
    try {
      const res = await api.getConversationMessages(convoId);
      const msgs = res.data || res || [];
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch (err) {
      console.error("Load messages error:", err);
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  // Socket
  useEffect(() => {
    const token = localStorage.getItem("token");
    const socket = connectSocket(token);
    if (!socket) return;

    fetchConversations();

    const onMessage = (msg) => {
      const messageConversationId =
        typeof msg.conversation === "string" ? msg.conversation : msg.conversation?._id;
      if (messageConversationId === activeIdRef.current) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
        if (msg.senderRole === "user" && !isNearBottomRef.current) {
          setShowNewBadge(true);
        }
      }
    };

    const onConvoUpdate = (convo) => {
      setConversations((prev) => {
        const exists = prev.find((c) => c._id === convo._id);
        let next;
        if (exists) {
          next = prev.map((c) => (c._id === convo._id ? convo : c));
        } else {
          next = [convo, ...prev];
        }
        next.sort(
          (a, b) =>
            new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
        );
        return next;
      });
    };

    const onTyping = ({ conversationId, role, isTyping }) => {
      if (conversationId === activeIdRef.current && role === "user") {
        setUserTyping(!!isTyping);
      }
    };

    socket.on("chat:message", onMessage);
    socket.on("chat:conversation-updated", onConvoUpdate);
    socket.on("chat:typing", onTyping);

    return () => {
      socket.off("chat:message", onMessage);
      socket.off("chat:conversation-updated", onConvoUpdate);
      socket.off("chat:typing", onTyping);
    };
  }, [fetchConversations]);

  // Join active conversation
  useEffect(() => {
    if (!activeId) return;
    const socket = getSocket();
    if (!socket) return;
    socket.emit("chat:join", { conversationId: activeId });
    loadMessages(activeId);
    socket.emit("chat:read", { conversationId: activeId });
    setShowNewBadge(false);
    isNearBottomRef.current = true;

    return () => {
      socket.emit("chat:leave", { conversationId: activeId });
    };
  }, [activeId, loadMessages]);

  // Auto-scroll
  useEffect(() => {
    if (isNearBottomRef.current) {
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    }
  }, [messages]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    isNearBottomRef.current = nearBottom;
    if (nearBottom) setShowNewBadge(false);
  };

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setShowNewBadge(false);
  };

  const handleSend = () => {
    const content = input.trim();
    if (!content || !activeId) return;
    const socket = getSocket();
    if (!socket) return;
    socket.emit("chat:send", { conversationId: activeId, content });
    setInput("");
    isNearBottomRef.current = true;
  };

  const handleTyping = (val) => {
    setInput(val);
    const socket = getSocket();
    if (!socket || !activeId) return;
    socket.emit("chat:typing", { conversationId: activeId, isTyping: true });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("chat:typing", { conversationId: activeId, isTyping: false });
    }, 1200);
  };

  const filtered = conversations.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.user?.name?.toLowerCase().includes(q) ||
      c.user?.email?.toLowerCase().includes(q) ||
      c.lastMessage?.toLowerCase().includes(q)
    );
  });

  const active = conversations.find((c) => c._id === activeId);

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

  const totalUnread = conversations.reduce(
    (s, c) => s + (c.unreadByAdmin || 0),
    0
  );

  return (
    <div className="h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex">
      {/* Conversations List */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50/50">
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <MessageCircle size={20} className="text-[#FF385C]" />
              Hỗ trợ khách hàng
            </h2>
            {totalUnread > 0 && (
              <span className="px-2 py-0.5 bg-[#FF385C] text-white text-xs font-bold rounded-full">
                {totalUnread}
              </span>
            )}
          </div>
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm khách hàng..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-100 rounded-lg outline-none border border-transparent focus:bg-white focus:border-[#FF385C]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              Chưa có cuộc hội thoại
            </div>
          ) : (
            filtered.map((c) => {
              const isActive = c._id === activeId;
              const unread = c.unreadByAdmin || 0;
              return (
                <button
                  key={c._id}
                  onClick={() => setActiveId(c._id)}
                  className={`w-full flex items-start gap-3 px-4 py-3 border-b border-gray-100 hover:bg-white cursor-pointer transition-colors text-left ${
                    isActive ? "bg-white border-l-4 border-l-[#FF385C]" : ""
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 text-white flex items-center justify-center font-semibold">
                      {c.user?.name?.charAt(0).toUpperCase() || <UserIcon size={18} />}
                    </div>
                    {unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1.5 bg-[#FF385C] text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm truncate ${
                          unread > 0 ? "font-bold text-gray-900" : "font-medium text-gray-800"
                        }`}
                      >
                        {c.user?.name || "Khách"}
                      </span>
                      <span className="text-[11px] text-gray-400 flex-shrink-0">
                        {formatRelative(c.lastMessageAt)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {c.user?.email}
                    </p>
                    <p
                      className={`text-xs truncate mt-1 ${
                        unread > 0 ? "text-gray-900 font-medium" : "text-gray-500"
                      }`}
                    >
                      {c.lastSenderRole === "admin" && "Bạn: "}
                      {c.lastMessage || "Chưa có tin nhắn"}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Panel */}
      <div className="flex-1 flex flex-col">
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 bg-gradient-to-b from-gray-50 to-white">
            <div className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center mb-4">
              <MessageCircle size={36} className="text-[#FF385C]" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">
              Chọn một cuộc hội thoại
            </h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm">
              Danh sách bên trái hiển thị tất cả khách hàng. Cuộc hội thoại mới
              nhất sẽ tự động lên đầu.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-white">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 text-white flex items-center justify-center font-semibold">
                {active.user?.name?.charAt(0).toUpperCase() || <UserIcon size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 text-sm">
                  {active.user?.name}
                </div>
                <div className="text-xs text-gray-500">{active.user?.email}</div>
              </div>
            </div>

            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-5 py-4 bg-gradient-to-b from-gray-50 to-white space-y-2 relative"
            >
              {loadingMsgs ? (
                <div className="flex justify-center items-center h-full text-gray-400 text-sm">
                  Đang tải...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex justify-center items-center h-full text-gray-400 text-sm">
                  Chưa có tin nhắn. Hãy gửi lời chào đầu tiên!
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
                  const mine = m.senderRole === "admin";
                  return (
                    <div
                      key={item.id}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[70%] flex flex-col ${mine ? "items-end" : "items-start"}`}>
                        {!mine && (
                          <span className="text-[10px] text-gray-400 mb-0.5 ml-2">
                            {m.sender?.name || "Khách"}
                          </span>
                        )}
                        <div
                          className={`px-4 py-2 rounded-2xl text-sm leading-relaxed break-words ${
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
              {userTyping && (
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

            {showNewBadge && (
              <button
                onClick={scrollToBottom}
                className="absolute bottom-[90px] left-1/2 -translate-x-1/2 bg-[#FF385C] text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1 hover:bg-[#E31C5F] cursor-pointer z-10"
              >
                <ChevronDown size={14} /> Tin nhắn mới
              </button>
            )}

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
                  placeholder="Trả lời khách hàng..."
                  className="flex-1 resize-none max-h-32 px-4 py-2.5 text-sm bg-gray-100 border border-transparent focus:bg-white focus:border-[#FF385C] rounded-xl outline-none transition-colors"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="h-10 px-4 flex items-center gap-2 rounded-xl bg-[#FF385C] text-white disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-[#E31C5F] cursor-pointer font-medium text-sm transition-colors"
                >
                  <Send size={14} /> Gửi
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CustomerSupport;
