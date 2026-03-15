import axios from 'axios';

// Create a configured axios instance
export const api = axios.create({
  baseURL: 'http://localhost:8000', // FastAPI backend URL
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
