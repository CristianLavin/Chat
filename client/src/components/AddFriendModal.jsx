import { useState, useContext } from 'react';
import axios from 'axios';
import { X, Search, UserPlus } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

export default function AddFriendModal({ onClose }) {
  const { token } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [foundUser, setFoundUser] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setFoundUser(null);
    setLoading(true);
    
    try {
      const res = await axios.get(`http://localhost:3000/api/users/search?email=${email}`);
      setFoundUser(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('User not found');
      } else {
        setError('Error searching user');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async () => {
    if (!foundUser) return;
    try {
      await axios.post('http://localhost:3000/api/friends/request', { addresseeId: foundUser.id });
      setMessage('Friend request sent!');
      setFoundUser(null);
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send request');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Add Friend</h2>
          <button onClick={onClose}><X size={24} /></button>
        </div>

        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-2">
            <input 
              type="email" 
              placeholder="Enter email address" 
              className="flex-1 border p-2 rounded"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <button type="submit" className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600">
              <Search size={20} />
            </button>
          </div>
        </form>

        {loading && <p className="text-gray-500 text-center">Searching...</p>}
        {error && <p className="text-red-500 text-center">{error}</p>}
        {message && <p className="text-green-500 text-center">{message}</p>}

        {foundUser && (
          <div className="border rounded-lg p-4 bg-gray-50 flex flex-col items-center">
             <div className="w-16 h-16 rounded-full bg-gray-300 overflow-hidden mb-2">
                {foundUser.avatar ? (
                    <img src={`http://localhost:3000${foundUser.avatar}`} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl font-bold">
                        {foundUser.username.charAt(0).toUpperCase()}
                    </div>
                )}
             </div>
             <h3 className="font-bold text-lg">{foundUser.username}</h3>
             <p className="text-gray-500 text-sm mb-1">{foundUser.email}</p>
             <p className="text-gray-600 italic text-sm mb-3">"{foundUser.description || 'No description'}"</p>
             
             <button 
                onClick={handleAddFriend}
                className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-full hover:bg-green-600"
             >
                <UserPlus size={18} />
                Send Request
             </button>
          </div>
        )}
      </div>
    </div>
  );
}
