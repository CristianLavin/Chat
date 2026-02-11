import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, User, Ban, UserPlus, Check } from 'lucide-react';

export default function UserProfileModal({ userId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`http://localhost:3000/api/users/${userId}`);
      setProfile(res.data);
    } catch (error) {
      console.error("Error fetching user profile", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBlockUser = async () => {
      if(!confirm("Are you sure you want to block this user?")) return;
      try {
          await axios.post('http://localhost:3000/api/friends/block', { userId });
          alert("User blocked");
          onClose();
      } catch (err) {
          console.error(err);
          alert("Failed to block user");
      }
  };

  const handleAddFriend = async () => {
      try {
          await axios.post('http://localhost:3000/api/friends/request', { addresseeId: userId });
          alert("Friend request sent");
          fetchProfile(); // Refresh status
      } catch (err) {
          console.error(err);
          alert("Failed to send request");
      }
  };

  if (loading) return null;
  if (!profile) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg p-6 w-80 flex flex-col items-center relative shadow-xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
            <X size={24} />
        </button>

        <div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden mb-4 border-4 border-white shadow">
            {profile.avatar ? (
                <img src={`http://localhost:3000${profile.avatar}`} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <User size={48} />
                </div>
            )}
        </div>

        <h2 className="text-xl font-bold mb-1">{profile.username}</h2>
        <div className={`text-xs px-2 py-1 rounded-full mb-3 ${profile.status === 'online' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
            {profile.status || 'Offline'}
        </div>
        
        {profile.description && (
            <p className="text-gray-600 text-center text-sm mb-4 px-4 italic">"{profile.description}"</p>
        )}

        <div className="text-xs text-gray-400 mb-6">{profile.email}</div>

        <div className="flex gap-3 w-full">
            {profile.friendshipStatus !== 'accepted' && profile.friendshipStatus !== 'pending' && profile.friendshipStatus !== 'blocked' && (
                <button 
                    onClick={handleAddFriend}
                    className="flex-1 bg-blue-500 text-white py-2 rounded text-sm flex items-center justify-center gap-2 hover:bg-blue-600 transition"
                >
                    <UserPlus size={16} /> Add Friend
                </button>
            )}
            
            {profile.friendshipStatus === 'pending' && (
                <div className="flex-1 bg-yellow-100 text-yellow-700 py-2 rounded text-sm flex items-center justify-center gap-2">
                    <Check size={16} /> Request Sent
                </div>
            )}

            {profile.friendshipStatus === 'accepted' && (
                <div className="flex-1 bg-green-100 text-green-700 py-2 rounded text-sm flex items-center justify-center gap-2">
                    <User size={16} /> Friends
                </div>
            )}

            <button 
                onClick={handleBlockUser}
                className="flex-1 bg-red-100 text-red-600 py-2 rounded text-sm flex items-center justify-center gap-2 hover:bg-red-200 transition"
            >
                <Ban size={16} /> Block
            </button>
        </div>
      </div>
    </div>
  );
}
