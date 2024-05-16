import axios from 'axios';

const api = axios.create({
  baseURL: 'https://www.tarkman.app',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
