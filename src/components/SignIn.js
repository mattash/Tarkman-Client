import React, { useState } from 'react';
import { signIn } from '../auth';

const SignIn = ({ history }) => {
  const [credentials, setCredentials] = useState({ email: '', password: '' });

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await signIn(credentials);
      history.push('/sessions');
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        Email:
        <input type="email" name="email" value={credentials.email} onChange={handleChange} className="border p-2 rounded w-full" />
      </label>
      <label className="block">
        Password:
        <input type="password" name="password" value={credentials.password} onChange={handleChange} className="border p-2 rounded w-full" />
      </label>
      <button type="submit" className="bg-blue-500 text-white p-2 rounded">Sign In</button>
    </form>
  );
};

export default SignIn;
