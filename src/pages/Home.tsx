import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, QrCode, HeartPulse, Activity } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <div className="max-w-3xl">
        <ShieldCheck className="h-24 w-24 text-emerald-600 mx-auto mb-8" />
        <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
          Protecting Lives with <span className="text-emerald-600">Traceable Medicine</span>
        </h1>
        <p className="text-xl text-slate-600 mb-10 leading-relaxed">
          MedTrace Benin is a cutting-edge platform designed to combat counterfeit drugs in West Africa. 
          Verify the authenticity of your medicine instantly using our secure QR code system.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link 
            to="/verify" 
            className="bg-emerald-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-emerald-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            <QrCode className="h-6 w-6" />
            Verify Medicine Now
          </Link>
          <Link 
            to="/register" 
            className="bg-white text-slate-700 border-2 border-slate-200 px-8 py-4 rounded-xl text-lg font-semibold hover:border-emerald-600 hover:text-emerald-600 transition-all flex items-center justify-center gap-2"
          >
            Join as Pharmacy
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="bg-emerald-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <QrCode className="h-6 w-6 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Instant Verification</h3>
            <p className="text-slate-600">Scan the QR code on any registered medicine packaging to instantly verify its authenticity and origin.</p>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Activity className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Supply Chain Tracking</h3>
            <p className="text-slate-600">End-to-end visibility from the manufacturer to the pharmacy shelf, ensuring the integrity of the supply chain.</p>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="bg-rose-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <HeartPulse className="h-6 w-6 text-rose-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Patient Safety</h3>
            <p className="text-slate-600">Protecting patients from the dangers of counterfeit drugs, ensuring they receive genuine, life-saving treatments.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
