import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SessionList from '../components/SessionList';

const Sessions = () => {
  return (
    <div>
      <Navbar />
      <main className="container mx-auto p-4">
        <SessionList />
      </main>
      <Footer />
    </div>
  );
};

export default Sessions;
