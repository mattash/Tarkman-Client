#!/bin/bash

# Create React app
npx create-react-app tarkman-client
cd tarkman-client

# Install dependencies
npm install axios pusher-js

# Create src/api.js
mkdir -p src
cat <<EOL > src/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://www.tarkman.app',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
EOL

# Create src/auth.js
cat <<EOL > src/auth.js
import api from './api';

export const signIn = async (credentials) => {
  const response = await api.post('/session', credentials);
  return response.data;
};

export const signOut = async () => {
  await api.delete('/sign_out');
};

export const signUp = async (userData) => {
  const response = await api.post('/users', userData);
  return response.data;
};
EOL

# Create src/pusher.js
cat <<EOL > src/pusher.js
import Pusher from 'pusher-js';

const pusher = new Pusher('YOUR_APP_KEY', {
  cluster: 'YOUR_APP_CLUSTER',
});

export default pusher;
EOL

# Create src/components/PartsList.js
mkdir -p src/components
cat <<EOL > src/components/PartsList.js
import React, { useEffect, useState, useRef } from 'react';
import api from '../api';
import Pusher from 'pusher-js';

const PartsList = ({ sessionId }) => {
  const [parts, setParts] = useState([]);
  const partsRef = useRef({});

  useEffect(() => {
    const fetchParts = async () => {
      try {
        const response = await api.get(\`/s/\${sessionId}/parts.json\`);
        setParts(response.data.parts);
      } catch (error) {
        console.error('Error fetching parts:', error);
      }
    };

    fetchParts();

    const pusher = new Pusher('YOUR_APP_KEY', {
      cluster: 'YOUR_APP_CLUSTER',
    });

    const channel = pusher.subscribe(\`session-\${sessionId}\`);
    channel.bind('part-updated', function (data) {
      const updatedPartId = data.part_id;
      const element = partsRef.current[updatedPartId];
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    return () => {
      pusher.unsubscribe(\`session-\${sessionId}\`);
    };
  }, [sessionId]);

  return (
    <div>
      <h1>Parts List for Session {sessionId}</h1>
      <ul>
        {parts.map(({ part }) => (
          <li key={part.id} ref={(el) => (partsRef.current[part.id] = el)}>
            <h2>Role: {part.role}</h2>
            <p><strong>Grabar:</strong> {part.grabar}</p>
            <p><strong>Transliteration:</strong> {part.translit}</p>
            <p><strong>English:</strong> {part.en}</p>
            <p><strong>Posture:</strong> {part.posture || 'N/A'}</p>
            <p><strong>Page:</strong> {part.page}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PartsList;
EOL

# Create src/App.js
cat <<EOL > src/App.js
import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import PartsList from './components/PartsList';
import SignIn from './components/SignIn';
import SignUp from './components/SignUp';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>Welcome to Tarkman Client</h1>
        </header>
        <main>
          <Switch>
            <Route path="/sessions/:id/parts" render={(props) => <PartsList sessionId={props.match.params.id} />} />
            <Route path="/sign_in" component={SignIn} />
            <Route path="/sign_up" component={SignUp} />
          </Switch>
        </main>
      </div>
    </Router>
  );
}

export default App;
EOL

# Create src/index.js
cat <<EOL > src/index.js
import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
EOL

echo "Setup complete. Navigate to the 'tarkman-client' directory and start your app with 'npm start'."