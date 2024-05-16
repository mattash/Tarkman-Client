import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <nav className="bg-header p-4 text-white">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold">Tarkman</Link>
        <div>
{/*           <Link to="/sign_in" className="mr-4">Sign In</Link>
          <Link to="/sign_up">Sign Up</Link> */}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
