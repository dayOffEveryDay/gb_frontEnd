import { useLayoutEffect, useRef, useState } from 'react';

// Keep list navigation outside the content that unmounts when a chat opens.
export default function useChatRoomListView({ isOpen, isLoading }) {
  const [activeTab, setActiveTab] = useState('active');
  const panelRef = useRef(null);
  const scrollPositions = useRef({ active: 0, ended: 0 });

  useLayoutEffect(() => {
    if (isOpen && !isLoading && panelRef.current) {
      panelRef.current.scrollTop = scrollPositions.current[activeTab];
    }
  }, [activeTab, isOpen, isLoading]);

  const rememberScroll = () => {
    if (isOpen && !isLoading && panelRef.current) {
      scrollPositions.current[activeTab] = panelRef.current.scrollTop;
    }
  };

  const changeTab = (tab) => {
    rememberScroll();
    setActiveTab(tab);
  };

  return { activeTab, changeTab, panelRef, rememberScroll };
}
