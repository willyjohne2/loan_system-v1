import { useState, useEffect } from 'react';

const GUIDE_SEEN_KEY = 'guide_seen_';

export const useHelpGuide = (role) => {
  const storageKey = GUIDE_SEEN_KEY + role;
  
  // Auto-open on first login
  const [isOpen, setIsOpen] = useState(() => {
    return !localStorage.getItem(storageKey);
  });

  const openGuide = () => setIsOpen(true);
  
  const closeGuide = () => {
    setIsOpen(false);
    // Mark as seen so it doesn't auto-open next time
    localStorage.setItem(storageKey, 'true');
  };

  return { isOpen, openGuide, closeGuide };
};
