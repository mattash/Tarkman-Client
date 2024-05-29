// src/components/Explanations.js
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { usePusher } from '../context/PusherContext';
import ReactMarkdown from 'react-markdown';

const Explanations = () => {
  const [explanation, setExplanation] = useState(null);
  const { id: sessionId } = useParams();
  const subscriptionData = usePusher();

  const fetchExplanation = async () => {
    try {
      const response = await api.get(`/s/${sessionId}/explanations/current.json`);
      setExplanation(response.data[0]);
    } catch (error) {
      console.error('Error fetching explanation:', error);
    }
  };

  useEffect(() => {
    fetchExplanation();
  }, [sessionId]);

  useEffect(() => {
    if (subscriptionData) {
      fetchExplanation();
    }
  }, [subscriptionData]);

  if (!explanation) {
    return <div className='text-gray-400'>No current explanations</div>;
  }

  return (
    <div className="bg-gray-100 text-gray-600 p-4 rounded-lg shadow-md w-full">
      <h2 className="text-2xl font-bold mb-2">{explanation.title}</h2>
      <ReactMarkdown>{explanation.description}</ReactMarkdown>
    </div>
  );
};

export default Explanations;
