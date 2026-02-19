import { useState, useEffect, useContext } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import Sidebar from './Sidebar';
import ChatArea from './ChatArea';
import CreateRoomModal from './CreateRoomModal';
import ProfileModal from './ProfileModal';

const SOCKET_URL = 'http://localhost:3000';

export default function ChatLayout() {
  const { user, token } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      if (user) {
        newSocket.emit('register_user', { userId: user.id });
      }
    });

    newSocket.on('room_updated', (updatedRoom) => {
        setRooms(prev => prev.map(r => r.id === updatedRoom.id ? { ...r, ...updatedRoom } : r));
        setCurrentRoom(prev => {
            if (prev?.id === updatedRoom.id) {
                return { ...prev, ...updatedRoom };
            }
            return prev;
        });
    });

    return () => newSocket.close();
  }, []);

  useEffect(() => {
    if (socket && user) {
      socket.emit('register_user', { userId: user.id });
    }
  }, [socket, user]);

  useEffect(() => {
    if (token) {
      fetchRooms();
    }
  }, [token]);

  const fetchRooms = async () => {
    if (!token) return;
    try {
      const res = await axios.get('http://localhost:3000/api/rooms', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRooms(res.data);
    } catch (error) {
      console.error("Error fetching rooms", error);
    }
  };

  const handleJoinRoom = (room) => {
    if (socket) {
      socket.emit('join_room', { roomId: room.id });
      setCurrentRoom(room);
    }
  };

  const handleRoomCreated = (newRoom) => {
      setRooms([...rooms, newRoom]);
      setShowCreateRoom(false);
      handleJoinRoom(newRoom);
  };

  const handleRoomDeleted = (deletedRoomId) => {
      setRooms(rooms.filter(r => r.id !== deletedRoomId));
      if (currentRoom?.id === deletedRoomId) {
          setCurrentRoom(null);
      }
  };

  const handleRoomUpdated = (updatedRoom) => {
      if (updatedRoom) {
          // If we have the specific room data from the socket, update it directly
          setRooms(prev => prev.map(r => r.id === updatedRoom.id ? { ...r, ...updatedRoom } : r));
          setCurrentRoom(prev => {
              if (prev?.id === updatedRoom.id) {
                  return { ...prev, ...updatedRoom };
              }
              return prev;
          });
      } else {
          // Fallback to fetching all rooms
          fetchRooms();
      }
  };

  const handleOpenAIChat = () => {
    if (!user) return;
    const aiRoom = {
      id: 'ai-chat',
      name: 'Chat con IA',
      type: 'ai',
      created_by: user.id,
      description: 'Habla con un asistente de IA',
      avatar: null
    };
    setCurrentRoom(aiRoom);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar 
        user={user} 
        rooms={rooms} 
        currentRoom={currentRoom}
        onSelectRoom={handleJoinRoom}
        onOpenCreateRoom={() => setShowCreateRoom(true)}
        onOpenProfile={() => setShowProfile(true)}
        onOpenAIChat={handleOpenAIChat}
      />
      
      {currentRoom ? (
        <ChatArea 
            socket={socket} 
            room={currentRoom} 
            user={user} 
            onDeleteRoom={handleRoomDeleted}
            onUpdateRoom={(data) => handleRoomUpdated(data)}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          Select a room to start chatting
        </div>
      )}

      {showCreateRoom && (
        <CreateRoomModal 
            onClose={() => setShowCreateRoom(false)} 
            onCreated={handleRoomCreated} 
        />
      )}

      {showProfile && (
        <ProfileModal 
            onClose={() => setShowProfile(false)} 
        />
      )}
    </div>
  );
}
