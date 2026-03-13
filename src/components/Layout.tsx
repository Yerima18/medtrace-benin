import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, LogOut, LayoutDashboard, PlusCircle, ScanLine, Users } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'fr' ? 'en' : 'fr');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link to="/" className="flex-shrink-0 flex items-center gap-2">
                <ShieldCheck className="h-8 w-8 text-emerald-600" />
                <span className="font-bold text-xl text-slate-900">MedTrace Benin</span>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/verify" className="text-slate-600 hover:text-emerald-600 flex items-center gap-1 font-medium">
                <ScanLine className="h-5 w-5" />
                <span className="hidden sm:inline">{t('nav.verify')}</span>
              </Link>

              {user ? (
                <>
                  <Link to="/dashboard" className="text-slate-600 hover:text-emerald-600 flex items-center gap-1 font-medium">
                    <LayoutDashboard className="h-5 w-5" />
                    <span className="hidden sm:inline">{t('nav.dashboard')}</span>
                  </Link>
                  {(user.role === 'admin' || user.role === 'distributor') && (
                    <Link to="/register-medicine" className="text-slate-600 hover:text-emerald-600 flex items-center gap-1 font-medium">
                      <PlusCircle className="h-5 w-5" />
                      <span className="hidden sm:inline">{t('nav.registerMedicine')}</span>
                    </Link>
                  )}
                  {user.role === 'admin' && (
                    <Link to="/admin/users" className="text-slate-600 hover:text-emerald-600 flex items-center gap-1 font-medium">
                      <Users className="h-5 w-5" />
                      <span className="hidden sm:inline">{t('nav.users')}</span>
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="ml-4 flex items-center gap-1 text-slate-600 hover:text-red-600 font-medium"
                  >
                    <LogOut className="h-5 w-5" />
                    <span className="hidden sm:inline">{t('nav.logout')}</span>
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-4 ml-4">
                  <Link to="/login" className="text-slate-600 hover:text-emerald-600 font-medium">
                    {t('nav.login')}
                  </Link>
                  <Link to="/register" className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-medium transition-colors">
                    {t('nav.register')}
                  </Link>
                </div>
              )}

              <button
                onClick={toggleLanguage}
                className="text-xs font-semibold px-2 py-1 rounded border border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-300 transition-colors"
                aria-label="Toggle language"
              >
                {i18n.language === 'fr' ? 'EN' : 'FR'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-slate-500 text-sm">
            &copy; {new Date().getFullYear()} MedTrace Benin. {t('footer.tagline')}
          </p>
        </div>
      </footer>
    </div>
  );
}
