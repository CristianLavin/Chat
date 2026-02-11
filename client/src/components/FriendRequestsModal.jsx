import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { X, Check, UserX } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

export default function FriendRequestsModal({ onClose }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/friends/requests');
      setRequests(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (friendshipId, action) => {
      try {
          await axios.put('http://localhost:3000/api/friends/respond', { friendshipId, action });
          // Remove from list
          setRequests(requests.filter(r => r.id !== friendshipId));
      } catch (err) {
          alert('Error processing request');
      }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Friend Requests</h2>
          <button onClick={onClose}><X size={24} /></button>
        </div>

        {loading ? (
            <p className="text-center text-gray-500">Loading...</p>
        ) : requests.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No pending requests.</p>
        ) : (
            <div className="flex-1 overflow-y-auto space-y-3">
                {requests.map(req => (
                    <div key={req.id} className="border p-3 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden">
                                {req.avatar ? (
                                    <img src={`http://localhost:3000${req.avatar}`} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center font-bold">
                                        {req.username.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div>
                                <div className="font-bold text-sm">{req.username}</div>
                                <div className="text-xs text-gray-500">{req.email}</div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => handleRespond(req.id, 'accept')}
                                className="p-2 bg-green-100 text-green-600 rounded hover:bg-green-200"
                                title="Accept"
                            >
                                <Check size={18} />
                            </button>
                            <button 
                                onClick={() => handleRespond(req.id, 'reject')}
                                className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200"
                                title="Reject"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}
