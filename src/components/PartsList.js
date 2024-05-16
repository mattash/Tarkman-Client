import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '../api';
import usePusher from '../hooks/usePusher';
import Navbar from '../components/Navbar';


const PartsList = ({ sessionId }) => {
  const [parts, setParts] = useState([]);
  const [selectedLang, setSelectedLang] = useState('en'); // Default language
  const partsRef = useRef({});

  const fetchParts = useCallback(async () => {
    try {
      const response = await api.get(`/s/${sessionId}/parts.json`);
      setParts(response.data.parts);
    } catch (error) {
      console.error('Error fetching parts:', error);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  const handlePartUpdated = (data) => {
    const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
    const { session, liturgy, part } = parsedData;
    console.log(parsedData)
    const element = partsRef.current[parsedData.part];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  usePusher(`channel_${sessionId}`, 'part_change', handlePartUpdated);

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
      <div className="sticky top-0 flex justify-center mb-6 bg-gray-800 py-2 z-10  rounded">
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