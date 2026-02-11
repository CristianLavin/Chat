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

    return () => newSocket.close();
  }, []);

  useEffect(() => {
    if (token) {
      fetchRooms();
    }
  }, [token]);

  const fetchRooms = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/rooms');
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

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar 
        user={user} 
        rooms={rooms} 
        currentRoom={currentRoom}
        onSelectRoom={handleJoinRoom}
        onOpenCreateRoom={() => setShowCreateRoom(true)}
        onOpenProfile={() => setShowProfile(true)}
      />
      
      {currentRoom ? (
        <ChatArea 
            socket={socket} 
            room={currentRoom} 
            user={user} 
            onDeleteRoom={handleRoomDeleted}
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
