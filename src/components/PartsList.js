// src/components/PartsList.js
import React, { useEffect, useState, useRef } from 'react';
import api from '../api';
import Navbar from './Navbar';
import { usePusher } from '../context/PusherContext';

const PartsList = ({ sessionId }) => {
  const [parts, setParts] = useState([]);
  const [selectedLang, setSelectedLang] = useState('en'); // Default language
  const partsRef = useRef({});
  const subscriptionData = usePusher();

  useEffect(() => {
    const fetchParts = async () => {
      try {
        const response = await api.get(`/s/${sessionId}/parts.json`);
        setParts(response.data.parts);
        const sessionResponse = await api.get(`/s/${sessionId}.json`);
        handlePartUpdated({ part: sessionResponse.data.session.current_part_id });
      } catch (error) {
        console.error('Error fetching parts:', error);
      }
    };

    fetchParts();
  }, [sessionId]);

  useEffect(() => {
    if (subscriptionData) {
      handlePartUpdated(subscriptionData);
    }
  }, [subscriptionData]);

  let focusedElement = null;

  const handlePartUpdated = (data) => {
    const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
    const { part } = parsedData;
    const element = partsRef.current[part];
    if (element) {
      const stickyElement = document.querySelector('.sticky');
      const offset = stickyElement.offsetHeight;
      console.log('offset', offset);

      if (focusedElement) {
        focusedElement.classList.remove('mt-14', 'focus');
      }

      element.classList.add('focus', 'mt-14', 'animate-flash');
      focusedElement = element;

      setTimeout(() => {
        element.classList.remove('animate-flash');
      }, 1000); // Duration of the animation

      element.scrollIntoView({ behavior: 'auto', block: 'start' });
      requestAnimationFrame(() => {
        window.scrollBy(0, -offset);
      });
    }
  };

  const renderPartContent = (part) => {
    switch (selectedLang) {
      case 'grabar':
        return <p>{part.grabar}</p>;
      case 'translit':
        return <p>{part.translit}</p>;
      case 'en':
        return <p>{part.en}</p>;
      case 'ru':
        return <p>{part.ru}</p>;
      default:
        return <p>{part.en}</p>;
    }
  };

  return (
    <div>
      <Navbar />
      <div className="bg-gray-800 text-white p-4 rounded-lg shadow-md">
        <div className="sticky top-0 flex justify-center mb-6 bg-gray-800 py-2 z-10 rounded">
          <button className={`px-4 py-2 rounded-l ${selectedLang === 'grabar' ? 'bg-gray-700' : 'bg-gray-600'}`} onClick={() => setSelectedLang('grabar')}>Գրաբար</button>
          <button className={`px-4 py-2 ${selectedLang === 'translit' ? 'bg-gray-700' : 'bg-gray-600'}`} onClick={() => setSelectedLang('translit')}>Translit</button>
          <button className={`px-4 py-2 ${selectedLang === 'en' ? 'bg-gray-700' : 'bg-gray-600'}`} onClick={() => setSelectedLang('en')}>English</button>
          <button className={`px-4 py-2 rounded-r ${selectedLang === 'ru' ? 'bg-gray-700' : 'bg-gray-600'}`} onClick={() => setSelectedLang('ru')}>Русский</button>
        </div>
        <ul className="space-y-4">
          {parts.map(({ part }) => (
            <li key={part.id} ref={(el) => (partsRef.current[part.id] = el)} className="bg-gray-700 p-4 rounded shadow hover:bg-gray-600 transition">
              <h2 className="font-semibold capitalize">{part.role}</h2>
              {renderPartContent(part)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default PartsList;
