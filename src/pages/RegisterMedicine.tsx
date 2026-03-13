import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PackagePlus, Download, CheckCircle } from 'lucide-react';

export default function RegisterMedicine() {
  useAuth(); // ensure user is loaded
  const [formData, setFormData] = useState({
    name: '',
    manufacturer: '',
    description: '',
    dosage: '',
    batch_number: '',
    expiration_date: '',
    quantity: 10
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<any>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const response = await fetch('/api/medicines/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          quantity: parseInt(formData.quantity.toString())
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage(data.message);
        setResult(data);
        setFormData({
          name: '',
          manufacturer: '',
          description: '',
          dosage: '',
          batch_number: '',
          expiration_date: '',
          quantity: 10
        });
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to register medicine');
      }
    } catch (err) {
      setStatus('error');
      setMessage('An error occurred. Please try again.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-emerald-100 p-3 rounded-xl">
            <PackagePlus className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Register New Batch</h1>
            <p className="text-slate-500">Add medicines to the traceability system and generate QR codes.</p>
          </div>
        </div>

        {status === 'success' && (
          <div className="mb-8 bg-emerald-50 border border-emerald-200 p-6 rounded-xl flex flex-col items-center text-center">
            <CheckCircle className="h-12 w-12 text-emerald-500 mb-4" />
            <h3 className="text-lg font-semibold text-emerald-900 mb-2">{message}</h3>
            <p className="text-emerald-700 mb-6">
              Batch ID: {result.batchId} | Generated {result.qrCodesCount} unique QR codes.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setStatus('idle')}
                className="bg-white text-emerald-700 border border-emerald-200 px-6 py-2 rounded-lg hover:bg-emerald-50 font-medium transition-colors"
              >
                Register Another Batch
              </button>
              <a 
                href={`/batch/${result.batchId}/qrcodes`}
                className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 font-medium transition-colors"
              >
                View QR Codes
              </a>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="mb-8 bg-rose-50 border border-rose-200 p-4 rounded-xl">
            <p className="text-rose-700 font-medium">{message}</p>
          </div>
        )}

        {status !== 'success' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Medicine Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g. Paracetamol 500mg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Manufacturer</label>
                <input
                  type="text"
                  name="manufacturer"
                  required
                  value={formData.manufacturer}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g. PharmaCorp"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Dosage (Optional)</label>
              <input
                type="text"
                name="dosage"
                value={formData.dosage}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="e.g. 500mg, twice daily"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={2}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Active ingredients, contraindications..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Batch Number</label>
                <input
                  type="text"
                  name="batch_number"
                  required
                  value={formData.batch_number}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g. BATCH-2023-XYZ"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Expiration Date</label>
                <input
                  type="date"
                  name="expiration_date"
                  required
                  value={formData.expiration_date}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity (Units)</label>
                <input
                  type="number"
                  name="quantity"
                  min="1"
                  max="10000"
                  required
                  value={formData.quantity}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 font-medium transition-colors disabled:opacity-50"
              >
                {status === 'loading' ? 'Processing...' : 'Register & Generate QR Codes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
