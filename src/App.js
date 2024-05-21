import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Sessions from './pages/Sessions';
import SessionDetail from './components/SessionDetail';
import SignIn from './components/SignIn';
import SignUp from './components/SignUp';
import Explanations from './components/Explanations';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Sessions />} />
            <Route path="/sessions/:id/parts" element={<SessionDetail />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/sessions/:id/explanations" element={<Explanations />} />
            <Route path="/sign_in" element={<SignIn />} />
            <Route path="/sign_up" element={<SignUp />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
