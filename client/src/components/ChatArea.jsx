import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, Paperclip, Lock, Ban, Trash2, Info, Users, X, ZoomIn, Smile, Image as ImageIcon, Phone, Video } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import RoomDetailsModal from './RoomDetailsModal';
import UserProfileModal from './UserProfileModal';

const STICKERS = [
  { id: 'smile', url: 'https://twemoji.maxcdn.com/v/latest/svg/1f600.svg' },
  { id: 'thumbs_up', url: 'https://twemoji.maxcdn.com/v/latest/svg/1f44d.svg' },
  { id: 'party', url: 'https://twemoji.maxcdn.com/v/latest/svg/1f389.svg' },
  { id: 'fire', url: 'https://twemoji.maxcdn.com/v/latest/svg/1f525.svg' },
  { id: 'heart', url: 'https://twemoji.maxcdn.com/v/latest/svg/2764.svg' }
];

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export default function ChatArea({ socket, room, user, onDeleteRoom, onUpdateRoom }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [file, setFile] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [roomPassword, setRoomPassword] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [viewUserId, setViewUserId] = useState(null); // For UserProfileModal
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [backgroundType, setBackgroundType] = useState('default');
  const [backgroundValue, setBackgroundValue] = useState('');
  const [callState, setCallState] = useState('idle'); // idle | calling | incoming | in_call
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [callTargetId, setCallTargetId] = useState(null);
  const [remoteUserId, setRemoteUserId] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const backgroundFileInputRef = useRef(null);
  const stickerPickerRef = useRef(null);
  const stickerFileInputRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const isVideoCallRef = useRef(false);
  const pendingOfferRef = useRef(null);

  useEffect(() => {
    // Close emoji picker when clicking outside
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
      if (stickerPickerRef.current && !stickerPickerRef.current.contains(event.target)) {
        setShowStickerPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMessages([]);
    setIsLocked(false);
    setRoomPassword('');
    setSelectedMessageId(null);
    fetchMessages();
  }, [room.id]);

  useEffect(() => {
    const loadMembers = async () => {
      if (!user) return;
      try {
        const res = await axios.get(`http://localhost:3000/api/rooms/${room.id}/details`);
        const others = (res.data.members || []).filter(m => m.id !== user.id);
        if (others.length === 1) {
          setCallTargetId(others[0].id);
        } else {
          setCallTargetId(null);
        }
      } catch (err) {
        setCallTargetId(null);
      }
    };
    loadMembers();
    setCallState('idle');
    setIsVideoCall(false);
    setRemoteUserId(null);
  }, [room.id, user]);

  useEffect(() => {
    if (!user) return;
    const stored = localStorage.getItem(`chat_background_${user.id}_${room.id}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setBackgroundType(parsed.type || 'default');
        setBackgroundValue(parsed.value || '');
      } catch {
        setBackgroundType('default');
        setBackgroundValue('');
      }
    } else {
      setBackgroundType('default');
      setBackgroundValue('');
    }
  }, [room.id, user]);

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

    const handleReactionUpdated = (payload) => {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === payload.messageId
              ? { ...msg, reactions: payload.reactions || [] }
              : msg
          )
        );
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('message_gone', handleMessageGone);
    socket.on('reaction_updated', handleReactionUpdated);

    const handleIncomingCall = ({ fromUserId, roomId, isVideo }) => {
      if (roomId && roomId !== room.id) return;
      setCallState('incoming');
      setIsVideoCall(!!isVideo);
      isVideoCallRef.current = !!isVideo;
      setRemoteUserId(fromUserId);
    };

    const handleCallOffer = ({ fromUserId, offer, isVideo }) => {
      pendingOfferRef.current = { fromUserId, offer, isVideo: !!isVideo };
      setIsVideoCall(!!isVideo);
      isVideoCallRef.current = !!isVideo;
      setRemoteUserId(fromUserId);
      if (callState === 'idle') {
        setCallState('incoming');
      }
    };

    const handleCallAnswer = async ({ fromUserId, answer }) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      setCallState('in_call');
      setRemoteUserId(fromUserId);
    };

    const handleCallIceCandidate = async ({ fromUserId, candidate }) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
      }
    };

    const handleCallHangup = () => {
      endCall();
    };

    socket.on('incoming_call', handleIncomingCall);
    socket.on('call_offer', handleCallOffer);
    socket.on('call_answer', handleCallAnswer);
    socket.on('call_ice_candidate', handleCallIceCandidate);
    socket.on('call_hangup', handleCallHangup);

    return () => {
        socket.off('receive_message', handleReceiveMessage);
        socket.off('message_deleted', handleMessageDeleted);
        socket.off('message_gone', handleMessageGone);
        socket.off('reaction_updated', handleReactionUpdated);
        socket.off('incoming_call', handleIncomingCall);
        socket.off('call_offer', handleCallOffer);
        socket.off('call_answer', handleCallAnswer);
        socket.off('call_ice_candidate', handleCallIceCandidate);
        socket.off('call_hangup', handleCallHangup);
    };
  }, [socket, room.id, user]);

  const createPeerConnection = (remoteId) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });
    pc.onicecandidate = (event) => {
      if (event.candidate && socket && remoteId) {
        socket.emit('call_ice_candidate', {
          fromUserId: user.id,
          toUserId: remoteId,
          candidate: event.candidate
        });
      }
    };
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (isVideoCallRef.current && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      } else if (!isVideoCallRef.current && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch(() => {});
      }
    };
    return pc;
  };

  const cleanupMedia = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      setLocalStream(null);
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  };

  const endCall = () => {
    cleanupMedia();
    if (socket && remoteUserId) {
      socket.emit('call_hangup', { fromUserId: user.id, toUserId: remoteUserId });
    }
    setCallState('idle');
    setRemoteUserId(null);
    setIsVideoCall(false);
  };

  const handleStartCall = async (video) => {
    if (!socket || !callTargetId || !user) return;
    try {
      const pc = createPeerConnection(callTargetId);
      peerConnectionRef.current = pc;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: !!video
      });
      setLocalStream(stream);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('call_user', {
        fromUserId: user.id,
        toUserId: callTargetId,
        roomId: room.id,
        isVideo: !!video
      });
      socket.emit('call_offer', {
        fromUserId: user.id,
        toUserId: callTargetId,
        offer,
        isVideo: !!video
      });
      setCallState('calling');
      setIsVideoCall(!!video);
      isVideoCallRef.current = !!video;
      setRemoteUserId(callTargetId);
    } catch (err) {
      setCallState('idle');
      cleanupMedia();
    }
  };

  const handleAcceptCall = async () => {
    if (!socket) return;
    const pending = pendingOfferRef.current;
    if (!pending) return;
    const { fromUserId, offer, isVideo } = pending;
    try {
      const pc = createPeerConnection(fromUserId);
      peerConnectionRef.current = pc;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: !!isVideo
      });
      setLocalStream(stream);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      if (localVideoRef.current && isVideo) {
        localVideoRef.current.srcObject = stream;
      }
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('call_answer', {
        fromUserId: user.id,
        toUserId: fromUserId,
        answer,
        isVideo
      });
      setCallState('in_call');
      setIsVideoCall(!!isVideo);
      isVideoCallRef.current = !!isVideo;
      setRemoteUserId(fromUserId);
      pendingOfferRef.current = null;
    } catch (err) {
      pendingOfferRef.current = null;
      setCallState('idle');
      cleanupMedia();
    }
  };

  const handleRejectCall = () => {
    if (socket && remoteUserId) {
      socket.emit('call_hangup', { fromUserId: user.id, toUserId: remoteUserId });
    }
    pendingOfferRef.current = null;
    setCallState('idle');
    setRemoteUserId(null);
    setIsVideoCall(false);
  };

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

  const onEmojiClick = (emojiData) => {
    setNewMessage(prev => prev + emojiData.emoji);
  };

  const handleSendSticker = (stickerUrl) => {
    if (!socket || isLocked) return;
    const messageData = {
      roomId: room.id,
      senderId: user.id,
      content: '',
      type: 'sticker',
      fileUrl: stickerUrl
    };
    socket.emit('send_message', messageData);
    setShowStickerPicker(false);
  };

  const handleCustomStickerFileChange = async (e) => {
    const stickerFile = e.target.files && e.target.files[0];
    if (!stickerFile || !socket || isLocked) return;
    const formData = new FormData();
    formData.append('file', stickerFile);
    try {
      const uploadRes = await axios.post('http://localhost:3000/api/upload', formData);
      const fileUrl = uploadRes.data.fileUrl;
      handleSendSticker(fileUrl);
    } catch (err) {
      console.error('Custom sticker upload failed', err);
    } finally {
      e.target.value = '';
    }
  };

  const handleToggleReaction = (messageId, emoji) => {
    if (!socket) return;
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;
    const current = msg.reactions || [];
    const already = current.some(r => r.user_id === user.id && r.emoji === emoji);

    setMessages(prev =>
      prev.map(m => {
        if (m.id !== messageId) return m;
        const prevReactions = m.reactions || [];
        let nextReactions;
        if (already) {
          nextReactions = prevReactions.filter(
            r => !(r.user_id === user.id && r.emoji === emoji)
          );
        } else {
          nextReactions = [...prevReactions, { user_id: user.id, emoji }];
        }
        return { ...m, reactions: nextReactions };
      })
    );

    const payload = { messageId, userId: user.id, emoji, roomId: room.id };
    if (already) {
      socket.emit('remove_reaction', payload);
    } else {
      socket.emit('add_reaction', payload);
    }
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

  const backgroundStyle = {};
  if (backgroundType === 'image' && backgroundValue) {
    backgroundStyle.backgroundImage = `url(${backgroundValue})`;
    backgroundStyle.backgroundSize = 'cover';
    backgroundStyle.backgroundPosition = 'center';
  } else if (backgroundType === 'theme-blue') {
    backgroundStyle.backgroundImage = 'linear-gradient(to bottom right, #ebf8ff, #bee3f8)';
  } else if (backgroundType === 'theme-dark') {
    backgroundStyle.backgroundImage = 'linear-gradient(to bottom right, #1f2933, #111827)';
  } else if (backgroundType === 'theme-paper') {
    backgroundStyle.backgroundImage = 'radial-gradient(circle at top left, #fdf6e3, #f5e6c4)';
  }

  const handleBackgroundThemeChange = (type) => {
    setBackgroundType(type);
    const value = type === 'image' ? backgroundValue : '';
    localStorage.setItem(
      `chat_background_${user.id}_${room.id}`,
      JSON.stringify({ type, value })
    );
  };

  const handleBackgroundImageChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setBackgroundType('image');
      setBackgroundValue(dataUrl);
      localStorage.setItem(
        `chat_background_${user.id}_${room.id}`,
        JSON.stringify({ type: 'image', value: dataUrl })
      );
    };
    reader.readAsDataURL(file);
  };

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
            <div className="flex items-center gap-1 mr-2">
                <button
                    type="button"
                    onClick={() => handleBackgroundThemeChange('default')}
                    className={`w-6 h-6 rounded-full border ${backgroundType === 'default' ? 'ring-2 ring-blue-500' : ''} bg-gray-100`}
                    title="Fondo por defecto"
                />
                <button
                    type="button"
                    onClick={() => handleBackgroundThemeChange('theme-blue')}
                    className={`w-6 h-6 rounded-full border ${backgroundType === 'theme-blue' ? 'ring-2 ring-blue-500' : ''} bg-gradient-to-br from-blue-50 to-blue-200`}
                    title="Tema azul"
                />
                <button
                    type="button"
                    onClick={() => handleBackgroundThemeChange('theme-dark')}
                    className={`w-6 h-6 rounded-full border ${backgroundType === 'theme-dark' ? 'ring-2 ring-blue-500' : ''} bg-gradient-to-br from-gray-800 to-black`}
                    title="Tema oscuro"
                />
                <button
                    type="button"
                    onClick={() => handleBackgroundThemeChange('theme-paper')}
                    className={`w-6 h-6 rounded-full border ${backgroundType === 'theme-paper' ? 'ring-2 ring-blue-500' : ''} bg-yellow-100`}
                    title="Tema papel"
                />
                <button
                    type="button"
                    onClick={() => backgroundFileInputRef.current && backgroundFileInputRef.current.click()}
                    className={`w-7 h-7 rounded-full border flex items-center justify-center text-gray-500 hover:bg-gray-100 ${backgroundType === 'image' ? 'ring-2 ring-blue-500' : ''}`}
                    title="Imagen de fondo personalizada"
                >
                    <ImageIcon size={16} />
                </button>
                <input
                    type="file"
                    accept="image/*"
                    ref={backgroundFileInputRef}
                    className="hidden"
                    onChange={handleBackgroundImageChange}
                />
            </div>
            {callTargetId && (
              <>
                <button
                  type="button"
                  onClick={() => handleStartCall(false)}
                  className="p-2 text-gray-400 hover:text-green-600 rounded hover:bg-green-50"
                  title="Llamada de voz"
                  disabled={callState !== 'idle'}
                >
                  <Phone size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => handleStartCall(true)}
                  className="p-2 text-gray-400 hover:text-purple-600 rounded hover:bg-purple-50"
                  title="Videollamada"
                  disabled={callState !== 'idle'}
                >
                  <Video size={20} />
                </button>
              </>
            )}
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

      {showInfo && <RoomDetailsModal room={room} onClose={() => setShowInfo(false)} onUpdated={onUpdateRoom} />}
      {viewUserId && <UserProfileModal userId={viewUserId} onClose={() => setViewUserId(null)} />}

      {callState !== 'idle' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-40">
          <div className="bg-white rounded-xl shadow-xl p-4 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">
                {callState === 'calling' && (isVideoCall ? 'Llamando (video)…' : 'Llamando (voz)…')}
                {callState === 'incoming' && (isVideoCall ? 'Videollamada entrante' : 'Llamada entrante')}
                {callState === 'in_call' && (isVideoCall ? 'En videollamada' : 'En llamada')}
              </h3>
              <button onClick={endCall} className="text-red-500 hover:text-red-600">
                <X size={20} />
              </button>
            </div>

            {isVideoCall && (
              <div className="flex gap-2 mb-3">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-1/3 rounded bg-black"
                />
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="flex-1 rounded bg-black"
                />
              </div>
            )}

            {!isVideoCall && (
              <p className="text-sm text-gray-600 mb-3">
                Llamada de voz usando tu micrófono.
              </p>
            )}

            {!isVideoCall && (
              <audio
                ref={remoteAudioRef}
                autoPlay
                className="hidden"
              />
            )}

            {callState === 'incoming' && (
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleRejectCall}
                  className="px-3 py-1.5 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 text-sm"
                >
                  Rechazar
                </button>
                <button
                  type="button"
                  onClick={handleAcceptCall}
                  className="px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 text-sm"
                >
                  Aceptar
                </button>
              </div>
            )}

            {callState !== 'incoming' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={endCall}
                  className="px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 text-sm"
                >
                  Colgar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-100" style={backgroundStyle}>
        {messages.map((msg, index) => {
            const isMe = msg.sender_id === user.id;

            const groupedReactions = {};
            (msg.reactions || []).forEach(r => {
              if (!groupedReactions[r.emoji]) {
                groupedReactions[r.emoji] = { emoji: r.emoji, count: 0, reactedByMe: false };
              }
              groupedReactions[r.emoji].count += 1;
              if (r.user_id === user.id) groupedReactions[r.emoji].reactedByMe = true;
            });

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
                                        <div className="relative group/img cursor-pointer" onClick={() => setPreviewImage(`http://localhost:3000${msg.file_url}`)}>
                                            <div className="max-w-[200px] max-h-[200px] overflow-hidden rounded relative">
                                                <img 
                                                    src={`http://localhost:3000${msg.file_url}`} 
                                                    alt="Shared" 
                                                    className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-105" 
                                                />
                                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                                    <ZoomIn size={24} className="text-white" />
                                                </div>
                                            </div>
                                            {msg.content && <p className="mt-2 text-sm">{msg.content}</p>}
                                        </div>
                                    )}
                                    {msg.type === 'sticker' && msg.file_url && (
                                        <div className="relative max-w-[160px] max-h-[160px]">
                                            <img
                                              src={msg.file_url.startsWith('http') ? msg.file_url : `http://localhost:3000${msg.file_url}`}
                                              alt="Sticker"
                                              className="w-full h-full object-contain"
                                            />
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
                            
                            {Object.keys(groupedReactions).length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                  {Object.values(groupedReactions).map(data => (
                                    <span
                                      key={data.emoji}
                                      className="px-1.5 py-0.5 rounded-full text-[11px] flex items-center gap-1 bg-white/60 text-gray-700"
                                    >
                                      <span>{data.emoji}</span>
                                      <span className="text-[10px]">{data.count}</span>
                                    </span>
                                  ))}
                              </div>
                            )}

                            {selectedMessageId === msg.id && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                  {REACTION_EMOJIS.map(emoji => {
                                    const data = groupedReactions[emoji] || { count: 0, reactedByMe: false };
                                    return (
                                      <button
                                        key={emoji}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleReaction(msg.id, emoji);
                                        }}
                                        className={`px-1.5 py-0.5 rounded-full text-xs flex items-center gap-1 border ${
                                          data.reactedByMe
                                            ? isMe
                                              ? 'bg-blue-600 text-white border-blue-600'
                                              : 'bg-gray-200 text-gray-900 border-gray-300'
                                            : 'bg-white/40 text-gray-600 border-transparent hover:border-gray-300'
                                        }`}
                                      >
                                        <span>{emoji}</span>
                                        {data.count > 0 && <span className="text-[10px]">{data.count}</span>}
                                      </button>
                                    );
                                  })}
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

      {/* Full Size Image Preview Modal */}
      {previewImage && (
          <div 
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setPreviewImage(null)}
          >
              <button 
                className="absolute top-6 right-6 text-white hover:text-gray-300 transition-colors z-[110]"
                onClick={() => setPreviewImage(null)}
              >
                  <X size={32} />
              </button>
              <img 
                src={previewImage} 
                alt="Full Preview" 
                className="max-w-full max-h-full object-contain rounded shadow-2xl animate-in zoom-in-95 duration-300" 
                onClick={(e) => e.stopPropagation()}
              />
          </div>
      )}

      {/* Input */}
      <div className="p-4 bg-white border-t">
        {file && (
            <div className="mb-2 p-2 bg-gray-100 rounded flex justify-between items-center">
                <span className="text-sm truncate max-w-xs">{file.name}</span>
                <button onClick={() => setFile(null)} className="text-red-500 text-xs">Remove</button>
            </div>
        )}
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
            <div className="relative flex items-center gap-1">
                <div ref={emojiPickerRef}>
                    <button 
                        type="button"
                        onClick={() => {
                          setShowEmojiPicker(!showEmojiPicker);
                          setShowStickerPicker(false);
                        }}
                        className="p-2 text-gray-500 hover:text-blue-500 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <Smile size={24} />
                    </button>
                    
                    {showEmojiPicker && (
                        <div className="absolute bottom-full left-0 mb-2 z-50">
                            <EmojiPicker 
                                onEmojiClick={onEmojiClick}
                                autoFocusSearch={false}
                                theme="light"
                                searchPlaceholder="Buscar emoji..."
                                width={300}
                                height={400}
                            />
                        </div>
                    )}
                </div>

                <div className="relative" ref={stickerPickerRef}>
                    <button
                        type="button"
                        onClick={() => {
                          setShowStickerPicker(!showStickerPicker);
                          setShowEmojiPicker(false);
                        }}
                        className="p-2 text-gray-500 hover:text-green-500 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ImageIcon size={22} />
                    </button>

                    {showStickerPicker && (
                      <div className="absolute bottom-full left-0 mb-2 z-50 bg-white rounded-lg shadow-lg p-2 w-56">
                        <div className="flex flex-wrap gap-2">
                          {STICKERS.map(sticker => (
                            <button
                              key={sticker.id}
                              type="button"
                              onClick={() => handleSendSticker(sticker.url)}
                              className="w-12 h-12 rounded-md overflow-hidden hover:ring-2 hover:ring-blue-400 transition-transform transform hover:scale-105"
                            >
                              <img src={sticker.url} alt={sticker.id} className="w-full h-full object-contain" />
                            </button>
                          ))}
                        </div>
                        <div className="mt-2 border-t pt-2">
                          <button
                            type="button"
                            onClick={() => stickerFileInputRef.current && stickerFileInputRef.current.click()}
                            className="w-full text-xs text-gray-600 hover:text-blue-600 hover:bg-gray-50 py-1 rounded"
                          >
                            Subir sticker personalizado
                          </button>
                          <input
                            type="file"
                            accept="image/*"
                            ref={stickerFileInputRef}
                            className="hidden"
                            onChange={handleCustomStickerFileChange}
                          />
                        </div>
                      </div>
                    )}
                </div>
            </div>

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
