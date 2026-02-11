import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { X } from 'lucide-react';

export default function CreateRoomModal({ onClose, onCreated }) {
  const { token } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [maxMembers, setMaxMembers] = useState(0);
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch FRIENDS instead of all users
    axios.get('http://localhost:3000/api/friends').then(res => {
      setUsers(res.data);
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData();
    formData.append('name', name);
    formData.append('type', 'group');
    if (password) formData.append('password', password);
    formData.append('description', description);
    formData.append('max_members', maxMembers);
    if (avatar) formData.append('avatar', avatar);
    formData.append('members', JSON.stringify(selectedUsers));

    try {
      const res = await axios.post('http://localhost:3000/api/rooms', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
      });
      onCreated(res.data);
    } catch (error) {
      console.error(error);
      alert('Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (userId) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Create Room</h2>
          <button onClick={onClose}><X size={24} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Room Avatar</label>
            <input 
              type="file" 
              accept="image/*"
              onChange={e => setAvatar(e.target.files[0])} 
              className="w-full text-sm" 
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Room Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="w-full border p-2 rounded" 
              required 
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              className="w-full border p-2 rounded" 
              placeholder="Room purpose..."
              rows={2}
            />
          </div>

          <div className="mb-4 flex gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Password (Opt)</label>
                <input 
                  type="text" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="w-full border p-2 rounded" 
                  placeholder="Secret..."
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Max Members</label>
                <input 
                  type="number" 
                  min="0"
                  value={maxMembers} 
                  onChange={e => setMaxMembers(e.target.value)} 
                  className="w-full border p-2 rounded" 
                  placeholder="0 = Unlimited"
                />
              </div>
          </div>

          <div className="mb-4 flex-1 overflow-y-auto">
            <label className="block text-sm font-medium mb-1">Add Members</label>
            <div className="space-y-2">
              {users.map(u => (
                <div 
                  key={u.id} 
                  onClick={() => toggleUser(u.id)}
                  className={`p-2 border rounded cursor-pointer flex items-center space-x-2 ${
                    selectedUsers.includes(u.id) ? 'bg-blue-100 border-blue-500' : ''
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-gray-300 overflow-hidden">
                     {u.avatar ? <img src={`http://localhost:3000${u.avatar}`} className="w-full h-full object-cover"/> : null}
                  </div>
                  <span>{u.username}</span>
                </div>
              ))}
            </div>
          </div>

          <button 
            type="submit" 
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Room'}
          </button>
        </form>
      </div>
    </div>
  );
}
