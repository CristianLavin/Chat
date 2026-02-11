import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, Paperclip, Lock, Ban, Trash2, Info, Users } from 'lucide-react';
import RoomDetailsModal from './RoomDetailsModal';
import UserProfileModal from './UserProfileModal';

export default function ChatArea({ socket, room, user, onDeleteRoom }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [file, setFile] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [roomPassword, setRoomPassword] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [viewUserId, setViewUserId] = useState(null); // For UserProfileModal
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Reset state on room change
    setMessages([]);
    setIsLocked(false);
    setRoomPassword('');
    setSelectedMessageId(null);
    fetchMessages();
  }, [room.id]);

  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (message) => {
        if (message.room_id === room.id) {
            setMessages((prev) => [...prev, message]);
            scrollToBottom();
        }
    };

    const handleMessageDeleted = (deletedMessageId) => {
        setMessages((prev) => prev.map(msg => 
            msg.id === deletedMessageId ? { ...msg, is_deleted: 1 } : msg
        ));
    };

    const handleMessageGone = (goneMessageId) => {
        setMessages((prev) => prev.filter(msg => msg.id !== goneMessageId));
        if (selectedMessageId === goneMessageId) setSelectedMessageId(null);
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('message_gone', handleMessageGone);

    return () => {
        socket.off('receive_message', handleReceiveMessage);
        socket.off('message_deleted', handleMessageDeleted);
        socket.off('message_gone', handleMessageGone);
    };
  }, [socket, room.id]);

  const handleDeleteMessage = (messageId, isMyMessage) => {
      // Logic:
      // If it's my message and NOT deleted: Ask "Delete for everyone?"
      // If it's my message and ALREADY deleted: Ask "Delete for me (hard)?"
      // If it's NOT my message: Ask "Delete for me?"
      
      const msg = messages.find(m => m.id === messageId);
      if (!msg) return;

      if (isMyMessage) {
          if (msg.is_deleted) {
              if (confirm("¿Eliminar este mensaje definitivamente?")) {
                  socket.emit('delete_message', { messageId, roomId: room.id });
              }
          } else {
             // Default behavior for own messages: Delete for everyone
             if (confirm("¿Eliminar este mensaje para todos?")) {
                 socket.emit('delete_message', { messageId, roomId: room.id });
             }
          }
      } else {
          // Received message -> Delete for me only
          if (confirm("¿Eliminar este mensaje solo para ti?")) {
              socket.emit('hide_message', { messageId, userId: user.id });
              // Optimistic update
              handleMessageGone(messageId);
          }
      }
  };

  const fetchMessages = async (password = '') => {
    try {
      const res = await axios.get(`http://localhost:3000/api/messages/${room.id}`, {
        params: { password }
      });
      setMessages(res.data);
      setIsLocked(false);
      scrollToBottom();
    } catch (error) {
      if (error.response && error.response.status === 403) {
        setIsLocked(true);
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !file) || isLocked) return;

    let fileUrl = null;
    let type = 'text';

    if (file) {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const uploadRes = await axios.post('http://localhost:3000/api/upload', formData);
            fileUrl = uploadRes.data.fileUrl;
            
            // Determine type
            if (file.type.startsWith('image/')) type = 'image';
            else if (file.type.startsWith('video/')) type = 'video';
            else if (file.type.startsWith('audio/')) type = 'audio';
            else type = 'file';

        } catch (err) {
            console.error("Upload failed", err);
            return;
        }
    }

    const messageData = {
        roomId: room.id,
        senderId: user.id,
        content: newMessage,
        type,
        fileUrl
    };

    socket.emit('send_message', messageData);
    setNewMessage('');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUnlock = (e) => {
      e.preventDefault();
      fetchMessages(roomPassword);
  };

  const handleBlockUser = async (userId) => {
      if(!confirm("Are you sure you want to block this user?")) return;
      try {
          await axios.post('http://localhost:3000/api/friends/block', { userId });
          alert("User blocked");
      } catch (err) {
          console.error(err);
          alert("Failed to block user");
      }
  };

  const handleDeleteRoom = async () => {
      const isCreator = room.created_by === user.id;
      const confirmMsg = isCreator 
        ? "Are you sure you want to DELETE this room? It will be removed for everyone." 
        : "Are you sure you want to LEAVE this room?";
      
      if (!confirm(confirmMsg)) return;

      try {
          await axios.delete(`http://localhost:3000/api/rooms/${room.id}`);
          onDeleteRoom(room.id);
      } catch (err) {
          console.error(err);
          alert("Failed to delete/leave room");
      }
  };

  if (isLocked) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-8 text-center">
            <Lock size={48} className="text-gray-400 mb-4" />
            <h2 className="text-xl font-bold mb-2">This room is password protected</h2>
            <form onSubmit={handleUnlock} className="flex gap-2">
                <input 
                    type="password" 
                    placeholder="Enter password"
                    value={roomPassword}
                    onChange={(e) => setRoomPassword(e.target.value)}
                    className="border p-2 rounded"
                />
                <button type="submit" className="bg-blue-500 text-white p-2 rounded">Unlock</button>
            </form>
        </div>
      );
  }

  // Safety check
  if (!user) return null;

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b bg-white flex justify-between items-center shadow-sm">
        <div 
            className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors flex-1"
            onClick={() => setShowInfo(true)}
        >
            <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
                {room.avatar ? (
                    <img src={`http://localhost:3000${room.avatar}`} alt="Room" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                        <Users size={20} />
                    </div>
                )}
            </div>
            <div>
                <h2 className="font-bold text-lg leading-tight flex items-center gap-2">
                    {room.name}
                    {room.password && <Lock size={14} className="text-gray-400" />}
                </h2>
                {room.description && (
                    <p className="text-xs text-gray-500 truncate max-w-[200px]">{room.description}</p>
                )}
            </div>
        </div>
        
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setShowInfo(true)}
                className="text-gray-400 hover:text-blue-500 p-2 rounded hover:bg-blue-50"
                title="Room Info"
            >
                <Info size={20} />
            </button>
            <button 
                onClick={handleDeleteRoom} 
                className="text-gray-400 hover:text-red-500 p-2 rounded hover:bg-red-50"
                title={room.created_by === user.id ? "Delete Room" : "Leave Room"}
            >
                <Trash2 size={20} />
            </button>
        </div>
      </div>

      {showInfo && <RoomDetailsModal room={room} onClose={() => setShowInfo(false)} />}
      {viewUserId && <UserProfileModal userId={viewUserId} onClose={() => setViewUserId(null)} />}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-100">
        {messages.map((msg, index) => {
            const isMe = msg.sender_id === user.id;
            return (
                <div key={index} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex max-w-[70%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Avatar */}
                        {!isMe && (
                             <div className="group relative">
                                 <div 
                                    className="w-8 h-8 rounded-full bg-gray-300 mr-2 flex-shrink-0 overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                                    onClick={() => setViewUserId(msg.sender_id)}
                                    title="View Profile"
                                 >
                                    {msg.avatar ? (
                                        <img src={`http://localhost:3000${msg.avatar}`} alt="Av" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-xs font-bold">
                                            {msg.username.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                 </div>
                             </div>
                        )}
                        
                        {/* Bubble */}
                        <div 
                            className={`p-3 rounded-lg relative group transition-all ${isMe ? 'bg-blue-500 text-white' : 'bg-white text-gray-800'} ${selectedMessageId === msg.id ? 'ring-4 ring-yellow-400 shadow-xl z-10' : ''}`}
                            onClick={(e) => {
                                // Prevent triggering if clicking a link or button inside
                                if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') return;
                                setSelectedMessageId(selectedMessageId === msg.id ? null : msg.id);
                            }}
                        >
                            {msg.is_deleted ? (
                                <div className="flex items-center gap-2 italic opacity-70">
                                    <Ban size={16} />
                                    <span>Mensaje eliminado</span>
                                </div>
                            ) : (
                                <>
                                    {!isMe && <div className="text-xs font-bold mb-1 opacity-70">{msg.username}</div>}
                                    
                                    {/* Content based on type */}
                                    {msg.type === 'text' && <p>{msg.content}</p>}
                                    {msg.type === 'image' && (
                                        <div className="relative">
                                            <img src={`http://localhost:3000${msg.file_url}`} alt="Shared" className="max-w-full rounded" />
                                            {msg.content && <p className="mt-2">{msg.content}</p>}
                                        </div>
                                    )}
                                    {msg.type === 'video' && (
                                        <div className="relative">
                                            <video controls src={`http://localhost:3000${msg.file_url}`} className="max-w-full rounded" />
                                            {msg.content && <p className="mt-2">{msg.content}</p>}
                                        </div>
                                    )}
                                    {msg.type === 'audio' && (
                                        <div className="relative">
                                            <audio controls src={`http://localhost:3000${msg.file_url}`} />
                                            {msg.content && <p className="mt-2">{msg.content}</p>}
                                        </div>
                                    )}
                                    {msg.type === 'file' && (
                                        <a href={`http://localhost:3000${msg.file_url}`} target="_blank" rel="noreferrer" className="flex items-center underline">
                                            <Paperclip size={16} className="mr-1" />
                                            Download File
                                        </a>
                                    )}
                                </>
                            )}

                            {/* Delete Button (For me or others) */}
                            {(selectedMessageId === msg.id || false) && (
                                <div className="absolute -top-4 -right-4 flex gap-1 z-50">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteMessage(msg.id, isMe);
                                        }}
                                        className="p-3 bg-red-600 text-white rounded-full shadow-lg border-2 border-white hover:bg-red-700 transition-transform transform hover:scale-110 flex items-center justify-center"
                                        title={isMe ? (msg.is_deleted ? "Eliminar definitivamente" : "Eliminar para todos") : "Eliminar para mí"}
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            )}
                            
                            <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                                {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                        </div>
                    </div>
                </div>
            );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t">
        {file && (
            <div className="mb-2 p-2 bg-gray-100 rounded flex justify-between items-center">
                <span className="text-sm truncate max-w-xs">{file.name}</span>
                <button onClick={() => setFile(null)} className="text-red-500 text-xs">Remove</button>
            </div>
        )}
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
            <button 
                type="button" 
                onClick={() => fileInputRef.current.click()} 
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
            >
                <Paperclip size={20} />
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={(e) => setFile(e.target.files[0])}
            />
            <input 
                type="text" 
                className="flex-1 border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
            />
            <button 
                type="submit" 
                className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50"
                disabled={!newMessage.trim() && !file}
            >
                <Send size={20} />
            </button>
        </form>
      </div>
    </div>
  );
}
