import React, { useState } from 'react';
import { signUp } from '../auth';

const SignUp = ({ history }) => {
  const [userData, setUserData] = useState({ email: '', password: '' });

  const handleChange = (e) => {
    setUserData({
      ...userData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await signUp(userData);
      history.push('/sign_in');
    } catch (error) {
      console.error('Error signing up:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        Email:
        <input type="email" name="email" value={userData.email} onChange={handleChange} className="border p-2 rounded w-full" />
      </label>
      <label className="block">
        Password:
        <input type="password" name="password" value={userData.password} onChange={handleChange} className="border p-2 rounded w-full" />
      </label>
      <button type="submit" className="bg-blue-500 text-white p-2 rounded">Sign Up</button>
    </form>
  );
};

export default SignUp;
