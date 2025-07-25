'use client';

import { useEffect, useState } from 'react';
import { Calendar, MapPin, Users, DollarSign, Star, Sun, Moon, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Package {
  packageName: string;
  destinationName: string;
  startFrom: number;
  hotelCount: number;
  noOfDays: number;
  noOfNight: number;
  packageId: string;
  planName: string;
  perfectFor: string;
  // Add other fields as necessary
}

export default function PackageDetailsPage({ params }: { params: { id: string } }) {
  const [pkg, setPackage] = useState<Package | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      fetch(`/api/packages?id=${params.id}`)
        .then(res => {
          if (!res.ok) {
            throw new Error('Failed to fetch package details');
          }
          return res.json();
        })
        .then(data => {
          if (data && data.length > 0) {
            setPackage(data[0]);
          } else {
            throw new Error('Package not found');
          }
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [params.id]);

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center min-h-screen">Error: {error}</div>;
  }

  if (!pkg) {
    return <div className="flex justify-center items-center min-h-screen">Package not found.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <Link href="/" passHref>
            <button className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800">
              <ArrowLeft className="w-5 h-5" />
              Back to Chat
            </button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{pkg.packageName}</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="p-8">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4">{pkg.destinationName}</h2>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-5 h-5 text-indigo-500" />
                  <span>{pkg.noOfDays} Days / {pkg.noOfNight} Nights</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Users className="w-5 h-5 text-green-500" />
                  <span>{pkg.hotelCount} Hotels</span>
                </div>
              </div>
            <div className="text-3xl font-bold text-indigo-600">
                ₹{pkg.startFrom.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="mt-8 space-y-4">
              <div className="flex items-center">
                <span className="text-lg font-semibold w-48">🏝️ Package Name</span>
                <span className="text-lg text-gray-700">{pkg.packageName}</span>
              </div>
              <div className="flex items-center">
                <span className="text-lg font-semibold w-48">📅 Duration</span>
                <span className="text-lg text-gray-700">{pkg.noOfNight} Nights / {pkg.noOfDays} Days</span>
              </div>
              <div className="flex items-center">
                <span className="text-lg font-semibold w-48">📍 Destination</span>
                <span className="text-lg text-gray-700">{pkg.destinationName}</span>
              </div>
              <div className="flex items-center">
                <span className="text-lg font-semibold w-48">💸 Starting From</span>
                <span className="text-lg text-gray-700">₹{pkg.startFrom.toLocaleString('en-IN')} per person</span>
              </div>
              <div className="flex items-center">
                <span className="text-lg font-semibold w-48">🎡 Highlights</span>
                <span className="text-lg text-gray-700">{pkg.planName}</span>
              </div>
              <div className="flex items-center">
                <span className="text-lg font-semibold w-48">💖 Perfect For</span>
                <span className="text-lg text-gray-700">{pkg.perfectFor}</span>
              </div>
              <div className="flex items-center">
                <span className="text-lg font-semibold w-48">🔖 Package ID</span>
                <span className="text-lg text-gray-700">{pkg.packageId}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
