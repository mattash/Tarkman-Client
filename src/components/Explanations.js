import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import usePusher from '../hooks/usePusher';


const Explanations = () => {
  const [explanation, setExplanation] = useState(null);

  // Get the session ID from the URL
  const { id: sessionId } = useParams();
  const [logData, setLogData] = useState('');


  const fetchExplanation = async () => {
    try {
      const response = await api.get(`/s/${sessionId}/explanations/current.json`);
      console.log(response);
      // setLogData(response.data[0]);
      setExplanation(response.data[0]);
    } catch (error) {
      console.error('Error fetching explanation:', error);
      setLogData(`${sessionId}`);
    }
  };

  useEffect(() => {
    fetchExplanation();
  }, [sessionId]);

  usePusher(`channel_${sessionId}`, 'part_change', () => {
    fetchExplanation();
  })

  if (!explanation) {
    return (
      <div>
        Loading... 
        
        <div>{logData}</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 text-gray-600 p-4 rounded-lg shadow-md w-full">
      <h2 className="text-2xl font-bold mb-2">{explanation.title}</h2>
      <p>{explanation.description}</p>
      <div>{logData}</div>
    </div>
  );
};

export default Explanations;
