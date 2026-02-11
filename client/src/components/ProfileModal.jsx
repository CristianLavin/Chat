import { useState, useContext, useRef } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { X, Camera } from 'lucide-react';

export default function ProfileModal({ onClose }) {
  const { user, updateUser } = useContext(AuthContext);
  const [username, setUsername] = useState(user.username || '');
  const [description, setDescription] = useState(user.description || '');
  const [status, setStatus] = useState(user.status || 'online');
  const [avatar, setAvatar] = useState(null);
  const [preview, setPreview] = useState(user.avatar ? `http://localhost:3000${user.avatar}` : null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatar(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      console.log('Attempting profile update with:', { username, description, status, hasAvatar: !!avatar });
      
      let response;
      if (avatar) {
        // Use FormData for avatar upload
        const formData = new FormData();
        formData.append('username', username);
        formData.append('description', description);
        formData.append('status', status);
        formData.append('avatar', avatar);
        
        response = await axios.put('http://localhost:3000/api/user/profile', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        // Use standard JSON for text-only updates (more reliable)
        response = await axios.put('http://localhost:3000/api/user/profile', {
          username,
          description,
          status,
          avatarUrl: user.avatar // Keep current avatar
        });
      }

      console.log('Server response:', response.data);
      if (response.data.user) {
        updateUser(response.data.user, response.data.token);
        onClose();
      }
    } catch (error) {
      console.error('Update failed:', error);
      alert('Failed to update profile: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Edit Profile</h2>
          <button onClick={onClose}><X size={24} /></button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col items-center mb-6">
            <div className="w-24 h-24 rounded-full bg-gray-200 relative overflow-hidden mb-2 group cursor-pointer" onClick={() => fileInputRef.current.click()}>
              {preview ? (
                <img src={preview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">No Img</div>
              )}
              <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="text-white" />
              </div>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*" />
            <span className="text-sm text-blue-500 cursor-pointer" onClick={() => fileInputRef.current.click()}>Change Avatar</span>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Username</label>
            <input 
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full border p-2 rounded"
              placeholder="Your name..."
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Status</label>
            <select 
              value={status} 
              onChange={e => setStatus(e.target.value)}
              className="w-full border p-2 rounded"
            >
              <option value="online">Online</option>
              <option value="busy">Busy</option>
              <option value="away">Away</option>
              <option value="offline">Offline</option>
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              className="w-full border p-2 rounded"
              rows="3"
              placeholder="Tell us about yourself... (Emojis supported 🚀)"
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
