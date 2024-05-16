import Pusher from 'pusher-js';

const pusher = new Pusher(process.env.REACT_APP_PUSHER_APP_KEY, {
  cluster: process.env.REACT_APP_PUSHER_CLUSTER,
});

export default pusher;
