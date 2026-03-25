import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export const usePaginatedQuery = ({
  queryKey,
  queryFn,
  pageSize = 10,
  params = {}
}) => {
  const [page, setPage] = useState(1);
  const [allResults, setAllResults] = useState([]);
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [...queryKey, page, params],
    queryFn: () => queryFn({ ...params, page, page_size: pageSize }),
    staleTime: 1000 * 30,
    keepPreviousData: true,
  });

  // Reset page when params change (e.g. switching tabs)
  useEffect(() => {
    setPage(1);
    // We intentionally DO NOT clear allResults here. 
    // We let 'keepPreviousData' show the old list until the new data arrives
    // and the other useEffect updates allResults.
  }, [JSON.stringify(params)]);

  useEffect(() => {
    if (data) {
      const results = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
      
      if (page === 1) {
        // If fetching new data for a filter change, don't update with stale data
        // Wait until fetch completes
        if (isFetching) return;
        
        // Fresh load or filter change — replace all
        setAllResults(results);
      } else {
        // Show More — append new results
        setAllResults(prev => {
          // Filter out any results that already exist in the state to prevent duplicate keys
          const existingIds = new Set(prev.map(item => item.id));
          const uniqueNewResults = results.filter(item => !existingIds.has(item.id));
          return [...prev, ...uniqueNewResults];
        });
      }
    }
  }, [data, page, params, isFetching]);

  const totalCount = data?.count || (Array.isArray(data) ? data.length : 0);
  const hasMore = allResults.length < totalCount;
  const canShowLess = allResults.length > pageSize;

  const showMore = useCallback(() => {
    if (hasMore) {
      setPage(prev => prev + 1);
    }
  }, [hasMore]);

  const showLess = useCallback(() => {
    if (canShowLess) {
      // Remove last page of results and decrement page
      setAllResults(prev => prev.slice(0, prev.length - pageSize));
      setPage(prev => Math.max(1, prev - 1));
    }
  }, [canShowLess, pageSize]);

  const reset = useCallback(() => {
    setPage(1);
    setAllResults([]);
    queryClient.invalidateQueries(queryKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(queryKey), queryClient]);

  return {
    data: allResults,
    isLoading,
    isFetching,
    hasMore,
    canShowLess,
    showMore,
    showLess,
    reset,
    totalCount,
    currentPage: page,
  };
};