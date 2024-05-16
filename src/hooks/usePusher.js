import { useEffect } from 'react';
import pusher from '../pusher';

const usePusher = (channelName, eventName, callback) => {
  useEffect(() => {
    const channel = pusher.subscribe(channelName);

    channel.bind(eventName, callback);

    return () => {
      channel.unbind(eventName, callback);
      pusher.unsubscribe(channelName);
    };
  }, [channelName, eventName, callback]);
};

export default usePusher;
