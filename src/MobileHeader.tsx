import React from 'react';
import { Lock, Menu, Unlock } from 'lucide-react';

interface MobileHeaderProps {
  isMenuOpen: boolean;
  isPageScrollLocked: boolean;
  setIsMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPageScrollLocked: React.Dispatch<React.SetStateAction<boolean>>;
}

function MobileHeader({
  isMenuOpen,
  isPageScrollLocked,
  setIsMenuOpen,
  setIsPageScrollLocked,
}: MobileHeaderProps) {
  return (
    <div className="relative z-30 flex items-center justify-between border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
      <button
        type="button"
        aria-label="메뉴 열기"
        aria-expanded={isMenuOpen}
        onClick={() => setIsMenuOpen(true)}
        className="rounded-xl p-2 text-neutral-700 transition-colors hover:bg-neutral-100"
      >
        <Menu size={24} />
      </button>
      <span className="text-sm font-bold tracking-tight text-neutral-900">
        Tessellation <span className="text-indigo-600">Studio</span>
      </span>
      <button
        type="button"
        aria-label={isPageScrollLocked ? '페이지 스크롤 잠금 해제' : '페이지 스크롤 잠금'}
        aria-pressed={isPageScrollLocked}
        title={isPageScrollLocked ? '페이지 스크롤 잠금 해제' : '페이지 스크롤 잠금'}
        onClick={() => setIsPageScrollLocked((locked) => !locked)}
        className={`rounded-xl p-2 transition-colors ${isPageScrollLocked ? 'bg-indigo-100 text-indigo-600' : 'text-neutral-700 hover:bg-neutral-100'}`}
      >
        {isPageScrollLocked ? <Lock size={21} /> : <Unlock size={21} />}
      </button>
    </div>
  );
}

export default React.memo(MobileHeader);
