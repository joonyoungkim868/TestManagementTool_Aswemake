import React, { useState, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';

export const LoginScreen = () => {
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const from = location.state?.from?.pathname || '/projects';

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        await login(email);
        setLoading(false);
        navigate(from, { replace: true });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 relative z-50">
            <div className="bg-white p-8 rounded-lg shadow-md w-96">
                <h1 className="text-2xl font-bold mb-6 text-center text-primary">TestJail</h1>
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">이메일</label>
                        <input
                            type="email"
                            className="mt-1 block w-full p-2 border rounded"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="이메일을 입력해 주세요"
                        />
                    </div>
                    <button disabled={loading} type="submit" className="w-full bg-primary text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50">
                        {loading ? '로그인 중...' : '로그인'}
                    </button>
                </form>
            </div>
        </div>
    );
};
