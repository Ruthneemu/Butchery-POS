import { useState } from 'react'
import  supabase  from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import Layout from "../components/layout";

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
      <form onSubmit={handleLogin} className="bg-white w-full max-w-sm p-6 md:p-8 rounded-xl shadow-md">

        <h2 className="text-2xl mb-4 text-center">Admin Login</h2>
{error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
 className="w-full p-3 mb-4 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full p-2 mb-3 border rounded"
        />
        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md transition duration-200">Login</button>
      </form>
    </div>
  )
}

export default Login
