import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../config/api';

const StoresCategory = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/stores/categories');
      setCategories(response.data.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">Stores</h1>
      
      <div className="grid grid-cols-2 gap-4">
        {categories.map((category) => (
          <div
            key={category.id}
            className="bg-white rounded-lg shadow-md p-4 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate(`/stores/category/${category.id}`)}
          >
            <div className="flex flex-col items-center">
              <img
                src={category.icon_url}
                alt={category.name}
                className="w-16 h-16 mb-2 rounded-lg object-cover"
              />
              <h3 className="font-semibold text-center">{category.name}</h3>
              <p className="text-sm text-gray-500">{category.store_count} stores</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StoresCategory;
