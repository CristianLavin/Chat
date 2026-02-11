import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { X, User, Shield, Edit2, Save, Camera } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

export default function RoomDetailsModal({ room, onClose, onUpdated }) {
  const { user } = useContext(AuthContext);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  
  // Edit states
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editAvatar, setEditAvatar] = useState(null);
  const [previewAvatar, setPreviewAvatar] = useState(null);

  useEffect(() => {
    fetchDetails();
  }, [room.id]);

  const fetchDetails = async () => {
    try {
      const res = await axios.get(`http://localhost:3000/api/rooms/${room.id}/details`);
      setDetails(res.data);
      setEditName(res.data.name);
      setEditDesc(res.data.description || '');
    } catch (error) {
      console.error("Error fetching room details", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (e) => {
      const file = e.target.files[0];
      if (file) {
          setEditAvatar(file);
          setPreviewAvatar(URL.createObjectURL(file));
      }
  };

  const handleSave = async () => {
      const formData = new FormData();
      formData.append('name', editName);
      formData.append('description', editDesc);
      if (editAvatar) {
          formData.append('avatar', editAvatar);
      }

      try {
          const res = await axios.put(`http://localhost:3000/api/rooms/${room.id}`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
          });
          
          // Refresh local details
          fetchDetails();
          
          // Notify parent with the new data
          if (onUpdated) {
              onUpdated({
                  id: room.id,
                  name: editName,
                  description: editDesc,
                  avatar: res.data.avatar || details.avatar
              });
          }
          
          setIsEditing(false);
          setEditAvatar(null);
          setPreviewAvatar(null);
      } catch (error) {
          console.error("Failed to update room", error);
          alert("Failed to update room");
      }
  };

  if (loading) return null;

  const isAdmin = user?.id === details?.created_by;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Room Info</h2>
          <div className="flex items-center gap-2">
              {isAdmin && !isEditing && (
                  <button onClick={() => setIsEditing(true)} className="text-blue-500 hover:bg-blue-50 p-1 rounded">
                      <Edit2 size={20} />
                  </button>
              )}
              <button onClick={onClose}><X size={24} /></button>
          </div>
        </div>

        <div className="flex flex-col items-center mb-6">
            <div className="relative group">
                <div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden mb-3">
                    {previewAvatar ? (
                        <img src={previewAvatar} alt="Preview" className="w-full h-full object-cover" />
                    ) : details?.avatar ? (
                        <img src={`http://localhost:3000${details.avatar}`} alt="Room Avatar" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <User size={48} />
                        </div>
                    )}
                </div>
                {isEditing && (
                    <label className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer text-white transition-opacity">
                        <Camera size={24} />
                        <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                    </label>
                )}
            </div>

            {isEditing ? (
                <div className="w-full space-y-2">
                    <input 
                        type="text" 
                        value={editName} 
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full border p-2 rounded text-center font-bold"
                        placeholder="Room Name"
                    />
                    <textarea 
                        value={editDesc} 
                        onChange={(e) => setEditDesc(e.target.value)}
                        className="w-full border p-2 rounded text-sm text-center"
                        placeholder="Description"
                        rows={2}
                    />
                    <div className="flex justify-center gap-2 mt-2">
                        <button onClick={handleSave} className="bg-blue-500 text-white px-4 py-1 rounded text-sm flex items-center gap-1">
                            <Save size={14} /> Save
                        </button>
                        <button onClick={() => { setIsEditing(false); setPreviewAvatar(null); }} className="bg-gray-300 text-gray-700 px-4 py-1 rounded text-sm">
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <h3 className="text-lg font-bold">{details?.name}</h3>
                    {details?.description && (
                        <p className="text-gray-500 text-center text-sm mt-1">{details.description}</p>
                    )}
                </>
            )}

            {details?.max_members > 0 && (
                <span className="text-xs bg-gray-100 px-2 py-1 rounded mt-2">
                    Limit: {details.max_members} members
                </span>
            )}
        </div>

        <div className="flex-1 overflow-y-auto">
            <h4 className="font-semibold mb-2 text-sm text-gray-600">Members ({details?.members?.length || 0})</h4>
            <div className="space-y-2">
                {details?.members?.map(member => (
                    <div key={member.id} className="flex items-center p-2 hover:bg-gray-50 rounded">
                        <div className="w-8 h-8 rounded-full bg-gray-300 mr-3 overflow-hidden">
                            {member.avatar ? (
                                <img src={`http://localhost:3000${member.avatar}`} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs font-bold">
                                    {member.username.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center">
                                <span className="font-medium text-sm">{member.username}</span>
                                {member.id === details.created_by && (
                                    <Shield size={12} className="ml-1 text-blue-500" />
                                )}
                            </div>
                            <div className="text-xs text-gray-400">{member.email}</div>
                        </div>
                        <div className={`w-2 h-2 rounded-full ${member.status === 'online' ? 'bg-green-500' : 'bg-gray-300'}`} />
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
}
