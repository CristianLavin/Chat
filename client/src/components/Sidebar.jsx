import { Plus, User, LogOut, UserPlus, Users, Bell, Bot } from 'lucide-react';
import { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import AddFriendModal from './AddFriendModal';
import FriendRequestsModal from './FriendRequestsModal';

export default function Sidebar({ user, rooms, currentRoom, onSelectRoom, onOpenCreateRoom, onOpenProfile, onOpenAIChat }) {
  const { logout } = useContext(AuthContext);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showRequests, setShowRequests] = useState(false);

  return (
    <div className="w-80 bg-white border-r flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={onOpenProfile}>
          <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden">
            {user?.avatar ? (
              <img src={`http://localhost:3000${user.avatar}`} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                <User size={20} />
              </div>
            )}
          </div>
          <div>
            <div className="font-semibold">{user?.username}</div>
            <div className="text-xs text-green-500">{user?.status || 'Online'}</div>
          </div>
        </div>
        <button onClick={logout} className="text-gray-500 hover:text-red-500">
            <LogOut size={20} />
        </button>
      </div>

      {/* Friends Actions */}
      <div className="p-2 border-b flex justify-around gap-2">
        <button 
          onClick={() => setShowAddFriend(true)}
          className="flex-1 p-2 text-gray-600 hover:bg-gray-100 rounded flex flex-col items-center text-xs"
        >
          <UserPlus size={20} className="mb-1" />
          Add Friend
        </button>
        <button 
          onClick={() => setShowRequests(true)}
          className="flex-1 p-2 text-gray-600 hover:bg-gray-100 rounded flex flex-col items-center text-xs"
        >
          <Bell size={20} className="mb-1" />
          Requests
        </button>
        <button
          onClick={onOpenAIChat}
          className="flex-1 p-2 text-purple-700 hover:bg-purple-50 rounded flex flex-col items-center text-xs border border-purple-200"
        >
          <Bot size={20} className="mb-1" />
          Chat IA
        </button>
      </div>

      {/* Rooms List */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="flex justify-between items-center mb-2 px-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase">Chats</h3>
          <button onClick={onOpenCreateRoom} className="p-1 hover:bg-gray-200 rounded">
            <Plus size={16} />
          </button>
        </div>
        
        <div className="space-y-1">
          {rooms.map(room => (
            <div 
              key={room.id}
              onClick={() => onSelectRoom(room)}
              className={`p-3 rounded-lg cursor-pointer flex items-center space-x-3 ${
                currentRoom?.id === room.id ? 'bg-blue-100' : 'hover:bg-gray-100'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-blue-200 flex-shrink-0 overflow-hidden flex items-center justify-center text-blue-700 font-bold">
                {room.avatar ? (
                  <img src={`http://localhost:3000${room.avatar}`} alt="Room" className="w-full h-full object-cover" />
                ) : (
                  room.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="font-medium truncate">{room.name}</div>
                <div className="text-xs text-gray-500 truncate">{room.type}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {showAddFriend && <AddFriendModal onClose={() => setShowAddFriend(false)} />}
      {showRequests && <FriendRequestsModal onClose={() => setShowRequests(false)} />}
    </div>
  );
}
