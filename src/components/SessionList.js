import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const SessionList = () => {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await api.get('/services.json');
        // console.log(response.data);
        setSessions(response.data);
      } catch (error) {
        console.error('Error fetching sessions:', error);
      }
    };

    fetchSessions();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Current Services</h1>
      <ul className="space-y-4">
        {Array.isArray(sessions) && sessions.length > 0 ? (
          sessions.map(({ session }) => (
            <li key={session.id} className="border p-4 rounded shadow hover:bg-gray-100 transition bg-gray-800 shadow-md">
              <Link to={`/sessions/${session.id}/parts`} className="flex items-center">
                <img src={session.avatar_url} alt="Avatar" className="w-16 h-16 rounded-full mr-4" />
                <div>
                  <h2 className="text-xl font-semibold text-blue-500 hover:underline">{session.liturgy}</h2>
                  <p className="text-gray-500 text-sm">{session.date} - {session.church_name}</p>
                </div>
              </Link>
            </li>
          ))
        ) : (
          <li className='border p-4 rounded shadow hover:bg-gray-100 transition bg-gray-800 shadow-md'>
            <p>No services are currently taking place.</p>
          </li>
        )}
      </ul>
    </div>
  );
};

export default SessionList;
