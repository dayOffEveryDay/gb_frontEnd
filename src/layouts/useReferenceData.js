import { useState, useEffect } from 'react';

import { fetchStores, fetchCategories } from '../api';

export default function useReferenceData() {
  const [stores, setStores] = useState([]);

  const [categories, setCategories] = useState([]);

  const [referenceError, setReferenceError] = useState('');

  const [isReferenceLoading, setIsReferenceLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadReferenceData = async () => {
      setIsReferenceLoading(true);
      setReferenceError('');

      try {
        const [storesData, categoriesData] = await Promise.all([fetchStores(), fetchCategories()]);

        if (cancelled) {
          return;
        }

        setStores(Array.isArray(storesData) ? storesData : []);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      } catch (error) {
        if (!cancelled) {
          setReferenceError(error.message);
        }
      } finally {
        if (!cancelled) {
          setIsReferenceLoading(false);
        }
      }
    };

    loadReferenceData();

    return () => {
      cancelled = true;
    };
  }, []);

  return { stores, setStores, categories, setCategories, referenceError, setReferenceError, isReferenceLoading, setIsReferenceLoading };
}
