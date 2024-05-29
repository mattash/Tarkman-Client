import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import pusher from '../pusher';

const PusherContext = createContext();

export const PusherProvider = ({ children, sessionId }) => {
  const [subscriptionData, setSubscriptionData] = useState(null);

  const handlePartUpdated = useCallback((data) => {
    const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
    setSubscriptionData(parsedData);
  }, []);

  useEffect(() => {
    const channel = pusher.subscribe(`channel_${sessionId}`);
    channel.bind('part_change', handlePartUpdated);

    return () => {
      channel.unbind('part_change', handlePartUpdated);
      pusher.unsubscribe(`channel_${sessionId}`);
    };
  }, [sessionId, handlePartUpdated]);

  return (
    <PusherContext.Provider value={subscriptionData}>
      {children}
    </PusherContext.Provider>
  );
};

export const usePusher = () => useContext(PusherContext);
